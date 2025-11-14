/* ============================================================
   WORLD BLESSING WALL — APP.JS v1.1 (My-Blessings + infinite)
   - includes persistent clientId to link user's future submissions
   - realtime my-blessings + public realtime feed
   - infinite scroll safe patch + micro-animations
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
  getDocs,
  where
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

// my-blessings DOM
const myList = document.getElementById("myBlessingsList");
const myEmpty = document.getElementById("myEmpty");
const toggleMy = document.getElementById("toggleMy");
const refreshMy = document.getElementById("refreshMy");

// micro-animation targets
let sparkleRoot = document.getElementById("sparkleBurst");
let liveToast   = document.getElementById("liveToast");
const titleEl   = document.querySelector(".title");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- STATE ----------
const renderedIds = new Set(); // public feed DOM ids
let lastDoc = null;
let initialLoaded = false;
let loadingMore = false; // guard pagination
const PAGE_LIMIT = 12;

// --------- CLIENT ID (persistent) & ipHash strategy ---------
// We generate and persist a clientId in localStorage so that ipHash is stable per browser.
// This lets "My Blessings" reliably find future submissions from the same browser.
//
// Note: older submissions created before adding this persistent clientId (if any) may
// have an ipHash that doesn't match. Those older docs won't appear in "My Blessings".
// Future submissions will be linked correctly.
function getClientId(){
  try {
    const key = "wbw_client_id_v1";
    let id = localStorage.getItem(key);
    if (id) return id;
    // generate random 16-byte id hex
    const arr = crypto.getRandomValues(new Uint8Array(12));
    id = [...arr].map(b=>b.toString(16).padStart(2,"0")).join("");
    localStorage.setItem(key, id);
    return id;
  } catch(e){
    // fallback to timestamp
    const id = "x" + Date.now().toString(36);
    try { localStorage.setItem("wbw_client_id_v1", id); } catch {}
    return id;
  }
}
const CLIENT_ID = getClientId();

// ipHash uses CLIENT_ID (stable) + UA + timezone
async function makeIpHash(){
  const seed = `${CLIENT_ID}::${navigator.userAgent}::${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(seed);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  // fallback
  let h = 0; for (let i=0;i<seed.length;i++){ h = (h*31 + seed.charCodeAt(i))|0; }
  return String(h >>> 0);
}

// ---------- Utils ----------

// COUNTER POP — requires .counter-anim in CSS
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
  const w = window.innerWidth;
  const x0 = Math.round(w/2);
  const y0 = Math.round(window.innerHeight * 0.42);

  for (let i=0;i<count;i++){
    const sp = document.createElement("div");
    sp.className = "wbw-spark";
    const angle = Math.random()*Math.PI*2;
    const dist = 60 + Math.random()*140;
    const tx = Math.round(Math.cos(angle)*dist) + "px";
    const ty = Math.round(Math.sin(angle)*dist - (20 + Math.random()*40)) + "px";
    sp.style.setProperty("--tx", tx);
    sp.style.setProperty("--ty", ty);
    sp.style.left = (x0 - 6 + (Math.random()*24-12)) + "px";
    sp.style.top  = (y0 - 6 + (Math.random()*24-12)) + "px";
    sparkleRoot.appendChild(sp);
    setTimeout(()=> { try{ sp.remove(); }catch{} }, 900);
  }
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
  if (infiniteObserver) return;
  sentinel = createSentinel();
  if (!('IntersectionObserver' in window)) return;
  infiniteObserver = new IntersectionObserver(async (entries) => {
    for (const e of entries){
      if (e.isIntersecting && e.intersectionRatio > 0) {
        if (!initialLoaded) return;
        if (loadingMore || !lastDoc) return;
        await loadMore();
      }
    }
  }, {
    root: null,
    rootMargin: "400px",
    threshold: 0
  });
  if (sentinel) infiniteObserver.observe(sentinel);
}

// ---------- Realtime (newest only for public feed) ----------
const liveNewest = query(
  collection(db,"blessings"),
  orderBy("timestamp","desc"),
  limit(1)
);

onSnapshot(liveNewest, (snap)=>{
  if (!initialLoaded) return;

  snap.docChanges().forEach(change => {
    if (change.type === "added"){
      const added = prependIfNew(change.doc);
      if (added) {
        animateCount(counterEl, renderedIds.size);
        triggerSparkle(8);
      }
      revealOnScroll();
    }
  });
});

// ---------- "My Blessings" (realtime) ----------
let myUnsub = null;
async function startMyBlss(){
  if (!myList) return;
  myList.innerHTML = "";
  myEmpty.textContent = "Loading…";
  try {
    const ipHash = await makeIpHash();
    const myQuery = query(
      collection(db,"blessings"),
      where("ipHash","==", ipHash),
      orderBy("timestamp","desc"),
      limit(50)
    );
    // detach previous
    if (typeof myUnsub === "function") myUnsub();
    myUnsub = onSnapshot(myQuery, (snap)=>{
      myList.innerHTML = "";
      if (snap.empty){
        myEmpty.textContent = "You haven't posted any blessings yet — write your first one!";
        return;
      }
      myEmpty.textContent = "";
      snap.docs.forEach(d=>{
        const el = makeCard(d.data(), d.id);
        myList.appendChild(el);
      });
    }, (err)=>{
      console.warn("MyBlessings snapshot failed", err);
      myEmpty.textContent = "Unable to load your blessings right now.";
    });
  } catch (err) {
    console.warn("startMyBlss failed", err);
    myEmpty.textContent = "Unable to load your blessings right now.";
  }
}

// toggle / refresh actions
if (toggleMy) {
  toggleMy.addEventListener("click", ()=>{
    const sec = document.getElementById("myBlessings");
    if (!sec) return;
    if (sec.style.display === "none") {
      sec.style.display = "";
      toggleMy.textContent = "Hide My Blessings";
    } else {
      sec.style.display = "none";
      toggleMy.textContent = "Show My Blessings";
    }
  });
}
if (refreshMy) refreshMy.addEventListener("click", ()=> startMyBlss());

// start my blessings once app loads (non-blocking)
startMyBlss();

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

    const ref = await addDoc(collection(db,"blessings"), base);
    await updateDoc(doc(db,"blessings", ref.id), { blessingId: ref.id }).catch(()=>{});

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

    if (statusBox) {
      statusBox.textContent = "Blessing submitted ✅";
      statusBox.style.color = "#bfe4c2";
    }

    // micro animations
    pulseSendBtn();
    triggerSparkle(14);
    showLiveToast("✨ Your blessing is live!");

    // clear input but keep country
    if (blessingInput) blessingInput.value = "";
    await sleep(1100);
    if (statusBox) {
      statusBox.textContent = "";
      statusBox.style.color = "";
    }

    // refresh "My Blessings" after submit (so new item shows without reload)
    startMyBlss();
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
  } catch {}
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

// ---------- Start "My Blessings" UI quick hint (runs after client ready) ----------
console.info("World Blessing Wall — app.js v1.1 loaded (My-Blessings enabled)");
