/* ============================================================
   WORLD BLESSING WALL — APP.JS v1.1 (Infinite-scroll safe patch)
   - Full readable source
   - Realtime newest + safe infinite scroll (auto-load older)
   - Manual "Load more" still supported
   - Micro-animations: send button pulse, sparkle burst, live toast
   - Keeps previous behavior (no DB deletions, no duplicates)
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
const loadMoreBtn   = document.getElementById("loadMore");
const noMoreEl      = document.getElementById("noMore");

const waShare   = document.getElementById("waShare");
const twShare   = document.getElementById("twShare");
const copyShare = document.getElementById("copyShare");

// micro-animation targets (may be absent; we'll create fallbacks in JS if needed)
let sparkleRoot = document.getElementById("sparkleBurst");
let liveToast   = document.getElementById("liveToast");
const titleEl   = document.querySelector(".title");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- State ----------
const renderedIds = new Set(); // track DOM rendered doc ids
let lastDoc = null;
let initialLoaded = false;
let loadingMore = false; // guard for pagination
const PAGE_LIMIT = 12;

// ---------- Inject minimal micro-animation CSS (so you don't have to edit style.css) ----------
(function injectMicroCSS(){
  if (document.getElementById("__wbw_micro_css")) return;
  const css = `
    /* micro animations injected by app.js v1.1 */
    .btn-primary.pulse { animation: wbw-pulse 900ms ease-in-out; }
    @keyframes wbw-pulse { 0%{ transform:scale(1); } 50%{ transform:scale(1.04); } 100%{ transform:scale(1); } }

    .live-toast {
      position: fixed;
      left: 50%;
      transform: translateX(-50%) translateY(0);
      bottom: 22vh;
      background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.95));
      color: #2a2008;
      padding: 10px 18px;
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      font-weight:600;
      z-index: 99999;
      opacity: 0;
      pointer-events: none;
      transition: opacity .28s ease, transform .28s cubic-bezier(.2,.9,.3,1);
    }
    .live-toast.show { opacity: 1; transform: translateX(-50%) translateY(-6px); }

    #sparkleBurst { position: fixed; left: 50%; top: 40vh; transform: translateX(-50%); pointer-events: none; z-index: 99998; }
    .wbw-spark { position:absolute; width:10px; height:10px; border-radius:50%; background: radial-gradient(circle at 35% 30%, #fff6d8, var(--gold)); opacity:0.95; transform: translate3d(0,0,0) scale(.9); animation: wbw-spark-anim 820ms ease-out forwards; }
    @keyframes wbw-spark-anim {
      0% { opacity:1; transform: translate3d(0,0,0) scale(1); }
      60% { opacity:0.9; }
      100% { opacity:0; transform: translate3d(var(--tx), var(--ty), 0) scale(.3); }
    }

    /* temporary shimmer on title when new blessing arrives */
    .title.shimmer { filter: drop-shadow(0 8px 26px rgba(240,180,60,0.12)); animation: wbw-title-shim 900ms ease-in-out; }
    @keyframes wbw-title-shim { 0%{ filter: none } 50%{ filter: drop-shadow(0 14px 40px rgba(240,180,60,0.28)) } 100%{ filter:none } }
  `;
  const s = document.createElement("style");
  s.id = "__wbw_micro_css";
  s.appendChild(document.createTextNode(css));
  document.head.appendChild(s);
})();

// ensure micro DOM elements exist (create fallback if missing)
(function ensureMicroDOM(){
  if (!sparkleRoot) {
    sparkleRoot = document.createElement("div");
    sparkleRoot.id = "sparkleBurst";
    document.body.appendChild(sparkleRoot);
  }
  if (!liveToast) {
    liveToast = document.createElement("div");
    liveToast.id = "liveToast";
    liveToast.className = "live-toast";
    liveToast.setAttribute("role","status");
    liveToast.setAttribute("aria-live","polite");
    liveToast.hidden = true;
    liveToast.innerHTML = `<span id="liveToastText">✨ Your blessing is live!</span>`;
    document.body.appendChild(liveToast);
  }
})();

// ---------- Utils ----------

// COUNTER POP — requires a small CSS class `.counter-anim` (you have this in style.css)
function animateCount(el, to){
  if (!el) return;
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
  if (parts[0].length === 2) {
    const cc = parts[0].toUpperCase();
    const rest = parts.slice(1).join(" ").trim();
    if (rest) return { country: rest, countryCode: cc };
    const byCode = Object.values(map).find(([code]) => code === cc);
    return { country: byCode ? byCode[1] : cc, countryCode: cc };
  }

  const key = raw.toLowerCase();
  if (map[key]) return { country: map[key][1], countryCode: map[key][0] };

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

// ---------- Micro-animation helpers ----------
function pulseSendBtn(){
  if (!sendBtn) return;
  sendBtn.classList.add("pulse");
  setTimeout(()=> sendBtn.classList.remove("pulse"), 900);
}

function showLiveToast(text = "✨ Your blessing is live!"){
  try {
    const txtEl = document.getElementById("liveToastText");
    if (txtEl) txtEl.textContent = text;
    liveToast.hidden = false;
    liveToast.classList.add("show");
    setTimeout(()=> {
      liveToast.classList.remove("show");
      setTimeout(()=> liveToast.hidden = true, 300);
    }, 1100);
  } catch(e){}
}

function triggerSparkle(count = 12){
  if (!sparkleRoot) return;
  // center point approximate
  const w = window.innerWidth;
  const x0 = Math.round(w/2);
  const y0 = Math.round(window.innerHeight * 0.42);

  const sparks = [];
  for (let i=0;i<count;i++){
    const sp = document.createElement("div");
    sp.className = "wbw-spark";
    // random direction and distance
    const angle = Math.random()*Math.PI*2;
    const dist = 60 + Math.random()*140;
    const tx = Math.round(Math.cos(angle)*dist) + "px";
    const ty = Math.round(Math.sin(angle)*dist - (20 + Math.random()*40)) + "px";
    sp.style.setProperty("--tx", tx);
    sp.style.setProperty("--ty", ty);
    // position near center of sparkleRoot
    sp.style.left = (x0 - 6 + (Math.random()*24-12)) + "px";
    sp.style.top  = (y0 - 6 + (Math.random()*24-12)) + "px";
    sparkleRoot.appendChild(sp);
    sparks.push(sp);
    // remove after animation
    setTimeout(()=> { try{ sp.remove(); }catch{} }, 900);
  }
  // small extra: briefly shimmer title
  if (titleEl) {
    titleEl.classList.add("shimmer");
    setTimeout(()=> titleEl.classList.remove("shimmer"), 900);
  }
}

// ---------- Card builder ----------
function makeCard(docData = {}, docId){
  const data = docData || {};
  const country = (data.country || "").trim();
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

// ---------- Pagination (loadInitial + loadMore) ----------
async function loadInitial(){
  try {
    const q1 = query(collection(db,"blessings"), orderBy("timestamp","desc"), limit(PAGE_LIMIT));
    const snap = await getDocs(q1);

    blessingsList.innerHTML = "";
    renderedIds.clear();

    snap.docs.forEach(d => appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    initialLoaded = true;

    animateCount(counterEl, renderedIds.size);

    if (!lastDoc) {
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
    } else {
      if (loadMoreBtn) loadMoreBtn.style.display = "block";
      if (noMoreEl) noMoreEl.textContent = "";
    }

    revealOnScroll();
    setupInfiniteObserver(); // start observing after initial load
  } catch (err) {
    console.warn("Initial load failed", err);
    if (statusBox) statusBox.textContent = "Unable to load blessings right now.";
  }
}
loadInitial();

async function loadMore(){
  // safe guard
  if (loadingMore) return;
  if (!lastDoc) {
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
    return;
  }
  loadingMore = true;
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  try {
    const qMore = query(
      collection(db,"blessings"),
      orderBy("timestamp","desc"),
      startAfter(lastDoc),
      limit(PAGE_LIMIT)
    );
    const snap = await getDocs(qMore);

    if (snap.empty){
      lastDoc = null;
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
      return;
    }

    snap.docs.forEach(d => appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    revealOnScroll();

    // if fewer than page or exactly equal but no more docs, hide button
    if (!lastDoc) {
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
    }

  } catch (err) {
    console.warn("Load more failed", err);
    if (statusBox) statusBox.textContent = "Failed to load more.";
  } finally {
    loadingMore = false;
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  }
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", loadMore);
}

// ---------- Infinite scroll (sentinel + IntersectionObserver) ----------
let infiniteObserver = null;
let sentinel = null;

function createSentinel(){
  if (document.getElementById("wbw_sentinel")) return document.getElementById("wbw_sentinel");
  sentinel = document.createElement("div");
  sentinel.id = "wbw_sentinel";
  sentinel.style.width = "1px";
  sentinel.style.height = "1px";
  sentinel.style.margin = "1px auto";
  blessingsList.insertAdjacentElement("afterend", sentinel);
  return sentinel;
}

function setupInfiniteObserver(){
  // only create observer once
  if (infiniteObserver) return;
  sentinel = createSentinel();
  if (!('IntersectionObserver' in window)) return; // fallback: user uses Load more button
  infiniteObserver = new IntersectionObserver(async (entries) => {
    for (const e of entries){
      if (e.isIntersecting && e.intersectionRatio > 0) {
        // if initial hasn't loaded, don't auto-load
        if (!initialLoaded) return;
        // if currently loading or no more docs, skip
        if (loadingMore || !lastDoc) return;
        // auto-load older blessings (do not block UI)
        await loadMore();
      }
    }
  }, {
    root: null,
    rootMargin: "400px", // start loading earlier
    threshold: 0
  });
  if (sentinel) infiniteObserver.observe(sentinel);
}

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
      if (added) {
        animateCount(counterEl, renderedIds.size);
        // micro-animations on live arrival
        triggerSparkle(8);
        // small title shimmer (already in triggerSparkle)
      }
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

    // Phase-3 micro-animations
    buttonPulse();
    sparkleBurst();
    showToast();

    // clear input but keep country so user can submit multiple quickly
    if (blessingInput) blessingInput.value = "";
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

/* ===== PHASE 3 — Micro-Animations ===== */

function showToast(msg = "✨ Your blessing is live!") {
  const toast = document.getElementById("liveToast");
  const text = document.getElementById("liveToastText");
  text.textContent = msg;
  toast.hidden = false;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(()=> toast.hidden = true, 500);
  }, 2000);
}

function buttonPulse() {
  const btn = document.getElementById("sendBtn");
  btn.classList.add("pulse");
  setTimeout(() => btn.classList.remove("pulse"), 350);
}

function sparkleBurst() {
  const box = document.getElementById("sparkleBurst");
  if (!box) return;

  for (let i = 0; i < 12; i++) {
    const s = document.createElement("div");
    s.className = "spark-pop";

    const angle = (Math.PI * 2 * i) / 12;
    const dist = 40;

    s.style.setProperty("--x", `${Math.cos(angle) * dist}px`);
    s.style.setProperty("--y", `${Math.sin(angle) * dist}px`);

    box.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }
}


// ---------- Done ----------
console.info("World Blessing Wall — app.js v1.1 loaded (infinite-scroll + micro-animations)");
