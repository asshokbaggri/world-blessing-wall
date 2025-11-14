/* ============================================================
   WORLD BLESSING WALL — APP.JS v1.1 (Infinite-scroll safe patch)
   - Minimal, surgical changes only:
     * Replaces manual "Load more" UX with automatic infinite-scroll
     * Keeps all existing behavior (realtime, submit flow, card builder)
     * Non-invasive: existing functions preserved; new small helpers added
   - NOTE: I only touched the pagination area and added a sentinel + observer.
   ============================================================ */

// ---------- Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC8CzspwB_GtrbUm-V2mIvumpPqbbq-f6k",
  authDomain: "world-blessing-wall.firebaseapp.com",
  projectId: "world-blessing-wall",
  storageBucket: "world-blessing-wall.firebasestorage.app",
  messagingSenderId: "552766948715",
  appId: "1:552766948715:web:427d27f309a2c2c345782e"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ---------- DOM ----------
const blessingInput = document.getElementById("blessingInput");
const countryInput  = document.getElementById("countryInput");
const sendBtn       = document.getElementById("sendBtn");
const statusBox     = document.getElementById("status");
const blessingsList = document.getElementById("blessingsList");
const counterEl     = document.getElementById("counter");
const loadMoreBtn   = document.getElementById("loadMore"); // left in place (will be hidden)
const noMoreEl      = document.getElementById("noMore");

const waShare   = document.getElementById("waShare");
const twShare   = document.getElementById("twShare");
const copyShare = document.getElementById("copyShare");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- State ----------
const renderedIds = new Set(); // track DOM rendered doc ids
let lastDoc = null;
let initialLoaded = false;
let isLoadingPage = false;     // NEW: prevent double-fetch
let reachedEnd = false;        // NEW: whether we've exhausted backend

// ---------- Utils ----------

// COUNTER POP — requires a small CSS class `.counter-anim` (see note)
function animateCount(el, to){
  if (!el) return;

  // pop animation: force reflow to retrigger
  el.classList.remove("counter-anim");
  void el.offsetWidth;
  el.classList.add("counter-anim");

  const from = Number(el.textContent || 0);
  const duration = 380;
  const start = performance.now();

  function frame(t){
    const p = Math.min(1, (t - start) / duration);
    el.textContent = Math.round(from + (to - from) * p);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// basic language detection (Devanagari vs Latin)
function detectLang(txt = ""){
  const dev = (txt.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (txt.match(/[A-Za-z]/g) || []).length;
  if (dev > 3 && dev > lat) return "hi";
  return "en";
}

// normalize country input -> { country, countryCode }
// Accepts "IN", "IN India", "India", "Bharat", etc.
function normalizeCountry(input = ""){
  const raw = (input || "").trim();
  if (!raw) return { country:"", countryCode:"" };

  const map = {
    "india": ["IN","India"], "in": ["IN","India"], "bharat": ["IN","India"],
    "usa": ["US","United States"], "us": ["US","United States"], "united states": ["US","United States"],
    "uae": ["AE","United Arab Emirates"], "dubai": ["AE","United Arab Emirates"],
    "uk": ["GB","United Kingdom"], "england": ["GB","United Kingdom"], "london": ["GB","United Kingdom"],
    "nepal": ["NP","Nepal"], "pakistan": ["PK","Pakistan"], "bangladesh": ["BD","Bangladesh"],
    "sri lanka": ["LK","Sri Lanka"], "china": ["CN","China"], "japan": ["JP","Japan"],
    "germany": ["DE","Germany"], "france": ["FR","France"], "canada": ["CA","Canada"],
    "australia": ["AU","Australia"], "singapore": ["SG","Singapore"], "indonesia": ["ID","Indonesia"]
  };

  const parts = raw.split(/\s+/);
  // If first token is two letters treat as code
  if (parts[0].length === 2) {
    const cc = parts[0].toUpperCase();
    const rest = parts.slice(1).join(" ").trim();
    if (rest) return { country: rest, countryCode: cc };
    const byCode = Object.values(map).find(([code]) => code === cc);
    return { country: byCode ? byCode[1] : cc, countryCode: cc };
  }

  const key = raw.toLowerCase();
  if (map[key]) return { country: map[key][1], countryCode: map[key][0] };

  // Fallback: return raw name and guess 2-letter code from first letters
  const guess = raw.slice(0,2).toUpperCase().replace(/[^A-Z]/g,"");
  const cc = guess.length === 2 ? guess : "";
  return { country: raw, countryCode: cc };
}

// generate emoji flag from ISO code (two letters)
function flagFromCode(cc = ""){
  if (!cc || cc.length !== 2) return "🌍";
  try {
    return String.fromCodePoint(
      0x1F1E6 + (cc.charCodeAt(0) - 65),
      0x1F1E6 + (cc.charCodeAt(1) - 65)
    );
  } catch {
    return "🌍";
  }
}

// Safe ipHash (no raw IP). Browser-only pseudo-hash using UA + timezone + random
async function makeIpHash(){
  const seed = `${navigator.userAgent}::${Intl.DateTimeFormat().resolvedOptions().timeZone}::${Math.random()}`;
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(seed);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  // fallback simple integer hash (not cryptographic)
  let h = 0; for (let i=0;i<seed.length;i++){ h = (h*31 + seed.charCodeAt(i))|0; }
  return String(h >>> 0);
}

// Non-blocking one-shot geo (returns {lat,lng} or null)
function getGeoOnce(){
  return new Promise(resolve=>{
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        city: "", region: "",
        lat: Number(pos.coords.latitude.toFixed(5)),
        lng: Number(pos.coords.longitude.toFixed(5))
      }),
      () => resolve(null),
      { enableHighAccuracy:false, timeout:2500, maximumAge:600000 }
    );
  });
}

// ---------- Card builder ----------
function makeCard(docData = {}, docId){
  const data = docData || {};
  const country = (data.country || "").trim();
  // prefer explicit countryCode, else normalize
  const cc = (data.countryCode || "").toUpperCase() || normalizeCountry(country).countryCode;
  const flag = flagFromCode(cc);

  let timeStr = "";
  try {
    const ts = data.timestamp || data.created;
    timeStr = ts?.toDate ? ts.toDate().toLocaleString() : new Date().toLocaleString();
  } catch {
    timeStr = new Date().toLocaleString();
  }

  const wrap = document.createElement("div");
  wrap.classList.add("blessing-card", "fade-up");
  if (docId) wrap.dataset.id = docId;

  wrap.innerHTML = `
    <b><span class="flag">${flag}</span> ${country || cc || "—"}</b>
    <div>${(data.text || "").replace(/\n/g,"<br>")}</div>
    <small>${timeStr}</small>
  `;
  return wrap;
}

// ---------- Render helpers (prevent duplicates) ----------
function prependIfNew(docSnap){
  const id = docSnap.id;
  if (renderedIds.has(id)) return false;
  const el = makeCard(docSnap.data(), id);
  blessingsList.prepend(el);
  renderedIds.add(id);
  return true;
}
function appendIfNew(docSnap){
  const id = docSnap.id;
  if (renderedIds.has(id)) return false;
  const el = makeCard(docSnap.data(), id);
  blessingsList.appendChild(el);
  renderedIds.add(id);
  return true;
}

// ---------- Pagination helpers (NEW: fetchNextPage + sentinel) ----------

async function fetchNextPage(pageSize = 12){
  // Returns number of docs fetched (0 -> end)
  if (isLoadingPage || reachedEnd) return 0;
  isLoadingPage = true;
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  try {
    const qMore = lastDoc ? query(
      collection(db,"blessings"),
      orderBy("timestamp","desc"),
      startAfter(lastDoc),
      limit(pageSize)
    ) : query(collection(db,"blessings"), orderBy("timestamp","desc"), limit(pageSize));

    const snap = await getDocs(qMore);

    if (snap.empty){
      // no more documents
      reachedEnd = true;
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
      // disconnect observer via sentinel if exists
      disconnectSentinelObserver();
      return 0;
    }

    snap.docs.forEach(d => appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length - 1] || lastDoc;
    revealOnScroll();
    animateCount(counterEl, renderedIds.size);
    return snap.docs.length;
  } catch (err) {
    console.warn("Fetch page failed", err);
    if (statusBox) statusBox.textContent = "Failed to load more.";
    return 0;
  } finally {
    isLoadingPage = false;
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  }
}

// Backwards-compatible: keep existing loadMoreBtn click behavior but reuse fetchNextPage
if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", async ()=>{
    if (!lastDoc && initialLoaded === false) return; // still loading
    await fetchNextPage(12);
  });
}

// ---------- Initial load + pagination ----------
async function loadInitial(){
  try {
    const q1 = query(collection(db,"blessings"), orderBy("timestamp","desc"), limit(12));
    const snap = await getDocs(q1);

    // clear before rendering
    blessingsList.innerHTML = "";
    renderedIds.clear();

    snap.docs.forEach(d => appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    initialLoaded = true;

    animateCount(counterEl, renderedIds.size);

    if (!lastDoc) {
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
      reachedEnd = true;
    } else {
      // Ensure loadMore button is hidden when using infinite scroll UI (we keep it for fallback)
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    }

    // Set up infinite sentinel observer AFTER initial render
    installSentinelObserver();

    revealOnScroll();
  } catch (err) {
    // gentle fallback (do not expose raw error to user)
    console.warn("Initial load failed", err);
    if (statusBox) statusBox.textContent = "Unable to load blessings right now.";
    // still install sentinel to allow retry
    installSentinelObserver();
  }
}
loadInitial();

// ---------- Realtime (newest only) ----------
const liveNewest = query(
  collection(db,"blessings"),
  orderBy("timestamp","desc"),
  limit(1)
);

onSnapshot(liveNewest, (snap)=>{
  // don't show realtime until initial list is loaded
  if (!initialLoaded) return;

  snap.docChanges().forEach(change => {
    if (change.type === "added"){
      const added = prependIfNew(change.doc);
      if (added) animateCount(counterEl, renderedIds.size);
      revealOnScroll();
    }
  });
});

// ---------- Submit flow ----------
if (sendBtn) {
  sendBtn.addEventListener("click", submitBlessing);
}
if (blessingInput) {
  blessingInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
  });
}

async function submitBlessing(){
  const rawText = (blessingInput?.value || "").trim();
  const rawCountry = (countryInput?.value || "").trim();

  if (!rawText) { if (blessingInput) blessingInput.focus(); return; }
  if (!rawCountry) { if (countryInput) countryInput.focus(); return; }

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.opacity = ".7";
  }

  try {
    const lang = detectLang(rawText);
    const { country, countryCode } = normalizeCountry(rawCountry);
    const ipHash = await makeIpHash();

    // canonical payload: timestamp is canonical; created kept for backward compat
    const base = {
      text: rawText,
      country,
      countryCode,
      timestamp: serverTimestamp(),
      created: serverTimestamp(),
      status: "approved",
      device: "web",
      source: (document.referrer ? new URL(document.referrer).hostname : "direct"),
      language: lang,
      sentimentScore: 0,
      ipHash,
      username: "",
      blessingId: ""
    };

    // Add document
    const ref = await addDoc(collection(db,"blessings"), base);

    // Backfill blessingId
    await updateDoc(doc(db,"blessings", ref.id), { blessingId: ref.id }).catch(()=>{});

    // Optional geo: do not block UI
    getGeoOnce().then(geo=>{
      if (geo) {
        updateDoc(doc(db,"blessings", ref.id), {
          "geo.city": geo.city,
          "geo.region": geo.region,
          "geo.lat": geo.lat,
          "geo.lng": geo.lng
        }).catch(()=>{});
      }
    });

    // Friendly UI feedback (do NOT expose raw errors)
    if (statusBox) {
      statusBox.textContent = "Blessing submitted ✅";
      statusBox.style.color = "#bfe4c2";
    }

    // clear input but keep country so user can submit multiple quickly
    if (blessingInput) blessingInput.value = "";
    // small delay and then clear message
    await sleep(1100);
    if (statusBox) {
      statusBox.textContent = "";
      statusBox.style.color = "";
    }
  } catch (err) {
    console.warn("Submit failed", err);
    if (statusBox) {
      statusBox.textContent = "Something went wrong — try again 🙏";
      statusBox.style.color = "#ffb4b4";
    }
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    }
  }
}

// ---------- Share buttons ----------
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl  = encodeURIComponent(location.href.split('#')[0] || window.location.href);

waShare?.addEventListener("click", ()=>{
  window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`, "_blank");
});
twShare?.addEventListener("click", ()=>{
  window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`, "_blank");
});
copyShare?.addEventListener("click", async ()=>{
  try {
    await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
    const prev = copyShare.textContent;
    copyShare.textContent = "Link Copied ✅";
    await sleep(1200);
    copyShare.textContent = prev || "Copy Link";
  } catch {
    // ignore
  }
});

// ---------- Particles (full-screen, always behind) ----------
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H, dpr;
  function resize(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener("resize", resize);

  const COUNT = Math.floor((W * H) / 28000) + 90;
  const stars = Array.from({ length: COUNT }).map(() => ({
    x: Math.random()*W,
    y: Math.random()*H,
    r: Math.random()*1.4 + 0.4,
    vx: Math.random()*0.2 - 0.1,
    vy: Math.random()*0.25 + 0.1,
    tw: Math.random()*Math.PI*2,
    ts: 0.005 + Math.random()*0.008
  }));

  function animate(){
    ctx.clearRect(0,0,W,H);
    for (const s of stars){
      s.x += s.vx;
      s.y += s.vy;
      s.tw += s.ts;
      if (s.y > H + 8){
        s.y = -8;
        s.x = Math.random()*W;
      }
      const glow = 0.6 + 0.4*Math.sin(s.tw);
      ctx.globalAlpha = glow;
      const g = ctx.createRadialGradient(s.x,s.y,0, s.x,s.y,s.r*7);
      g.addColorStop(0,"rgba(255,240,190,1)");
      g.addColorStop(1,"rgba(255,240,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r*7,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }
  animate();
})();

// ---------- Scroll fade reveal ----------
function revealOnScroll(){
  const els = document.querySelectorAll(".fade-up, .fade-section");
  const trigger = window.innerHeight * 0.92;
  els.forEach(el => {
    if (el.getBoundingClientRect().top < trigger) el.classList.add("show");
  });
}
window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);

// ---------- Infinite sentinel + IntersectionObserver (NEW) ----------
let sentinel = null;
let sentinelObserver = null;

function installSentinelObserver(){
  // If already installed => return
  if (sentinelObserver) return;

  // Create sentinel element after the list if not present
  sentinel = document.getElementById("infiniteSentinel");
  if (!sentinel){
    sentinel = document.createElement("div");
    sentinel.id = "infiniteSentinel";
    sentinel.style.width = "100%";
    sentinel.style.height = "24px";
    sentinel.style.display = "block";
    sentinel.style.margin = "12px 0";
    // place after blessingsList
    if (blessingsList && blessingsList.parentNode){
      blessingsList.parentNode.insertBefore(sentinel, blessingsList.nextSibling);
    } else {
      document.body.appendChild(sentinel);
    }
  }

  // If we've already reached end, no need to observe
  if (reachedEnd) return;

  sentinelObserver = new IntersectionObserver(async (entries) => {
    for (const e of entries){
      if (e.isIntersecting) {
        // When user scrolls near sentinel, fetch next page
        // Use a slightly larger page size for first auto loads
        await fetchNextPage(12);
      }
    }
  }, {
    root: null,
    rootMargin: "400px", // trigger before user hits bottom
    threshold: 0.01
  });

  sentinelObserver.observe(sentinel);
}

function disconnectSentinelObserver(){
  if (sentinelObserver){
    try { sentinelObserver.disconnect(); } catch {}
    sentinelObserver = null;
  }
  if (sentinel && sentinel.parentNode){
    // keep sentinel node but hide it
    sentinel.style.display = "none";
  }
}

// ---------- Done ----------
console.info("World Blessing Wall — app.js v1.1 (infinite scroll) loaded");
