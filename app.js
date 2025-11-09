/* ===========================================
   WORLD BLESSING WALL — APP (ULTRA DELUXE)
   FINAL + INFINITE SCROLL ✅
   =========================================== */

// ---------- Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, startAfter, getDocs
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
const loadSpin      = document.getElementById("loadSpin");
const sentinel      = document.getElementById("scrollSentinel");

const waShare   = document.getElementById("waShare");
const twShare   = document.getElementById("twShare");
const copyShare = document.getElementById("copyShare");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- Helpers ----------
function animateCount(el, to) {
  if (!el) return;
  const from = Number(el.textContent || 0);
  const dur = 420, t0 = performance.now();
  function tick(t){
    const p = Math.min(1, (t - t0)/dur);
    el.textContent = Math.round(from + (to - from)*p);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function makeCard({ country, text, created }) {
  const wrap = document.createElement("div");
  wrap.classList.add("card", "blessing-card", "fade-up");
  const timeStr = created?.toDate ? created.toDate().toLocaleString() : new Date().toLocaleString();
  wrap.innerHTML = `
    <b>${country || "–"}</b>
    <div>${(text || "").replace(/\n/g, "<br>")}</div>
    <small>${timeStr}</small>
  `;
  return wrap;
}

// ---------- Submit ----------
async function submitBlessing(){
  const text = blessingInput.value.trim();
  const country = (countryInput.value || "").trim();
  if (!text) { blessingInput.focus(); return; }
  if (!country) { countryInput.focus(); return; }

  try{
    sendBtn.disabled = true; sendBtn.style.opacity = .7;
    await addDoc(collection(db, "blessings"), {
      text, country, created: serverTimestamp(), approved: true
    });
    statusBox.textContent = "Blessing submitted ✅";
    statusBox.style.color = "#bfe4c2";
    blessingInput.value = "";
    await sleep(120);
  }catch(err){
    statusBox.textContent = "Error: " + (err?.message || "Failed to submit");
    statusBox.style.color = "#ffb4b4";
    console.error(err);
  }finally{
    sendBtn.disabled = false; sendBtn.style.opacity = 1;
  }
}
sendBtn?.addEventListener("click", submitBlessing);
blessingInput?.addEventListener("keydown", (e)=>{ if ((e.ctrlKey||e.metaKey)&&e.key==="Enter") submitBlessing(); });

// ---------- Realtime (TOP N fresh) ----------
const RUNTIME_TOP = 10;      // live top items real-time
const PAGE_SIZE   = 20;      // per page for older items

let lastDoc = null;          // paging cursor (older)
let isLoading = false;
let reachedEnd = false;
const renderedIds = new Set();

function renderDoc(doc){
  if (renderedIds.has(doc.id)) return;
  blessingsList.appendChild(makeCard(doc.data()));
  renderedIds.add(doc.id);
}

const liveQ = query(
  collection(db,"blessings"),
  orderBy("created","desc"),
  limit(RUNTIME_TOP)
);

onSnapshot(liveQ, (snap)=>{
  // Rebuild top section (preserve older ones)
  // Strategy: remove any of the current first N, then re-insert fresh N in order.
  // Simpler approach for now: clear ALL then re-render top + keep paging intact by IDs Set.
  blessingsList.innerHTML = "";
  renderedIds.clear();

  snap.forEach(doc => renderDoc(doc));
  lastDoc = snap.docs[snap.docs.length - 1] || lastDoc; // cursor for older pages

  // We don't know global total cheaply; show displayed count (top + older loaded)
  animateCount(counterEl, renderedIds.size);
});

// ---------- Paging: older items ----------
async function loadMore(){
  if (isLoading || reachedEnd) return;
  if (!lastDoc) return;  // wait till first live snapshot arrives

  isLoading = true;
  if (loadMoreBtn) loadMoreBtn.disabled = true;
  if (loadSpin) loadSpin.style.display = "inline-block";

  try{
    const qMore = query(
      collection(db,"blessings"),
      orderBy("created","desc"),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );

    const snap = await getDocs(qMore);

    if (snap.empty){
      reachedEnd = true;
      if (loadMoreBtn){ loadMoreBtn.textContent = "No more"; loadMoreBtn.disabled = true; }
      if (sentinel) sentinel.remove(); // stop infinite observer
      return;
    }

    snap.forEach(doc => renderDoc(doc));
    lastDoc = snap.docs[snap.docs.length - 1];
    animateCount(counterEl, renderedIds.size);

  }catch(err){
    console.error(err);
  }finally{
    isLoading = false;
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    if (loadSpin) loadSpin.style.display = "none";
  }
}
loadMoreBtn?.addEventListener("click", loadMore);

// Auto-infinite via sentinel
if ('IntersectionObserver' in window && sentinel){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e => { if (e.isIntersecting) loadMore(); });
  }, { root: null, threshold: 0.1 });
  io.observe(sentinel);
}

// ---------- Share ----------
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl  = encodeURIComponent(location.href.split('#')[0]);
waShare?.addEventListener("click", ()=> window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`,'_blank'));
twShare?.addEventListener("click", ()=> window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,'_blank'));
copyShare?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
    copyShare.textContent = "Link Copied ✅";
    await sleep(1200);
    copyShare.textContent = "Copy Link";
  }catch{}
});

// ---------- GOLD PARTICLES ----------
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let W, H;
  function resize(){
    W = window.innerWidth; H = window.innerHeight;
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    canvas.width  = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize(); window.addEventListener("resize", resize);

  const COUNT = Math.floor((W*H)/28000) + 90;
  const stars = Array.from({length:COUNT}).map(()=>({
    x: Math.random()*W, y: Math.random()*H,
    r: Math.random()*1.4 + 0.5, a: Math.random()*0.7 + 0.3,
    vx: (Math.random()*0.2 - 0.1), vy: (Math.random()*0.18 + 0.04),
    tw: Math.random()*Math.PI*2, ts: 0.006 + Math.random()*0.012
  }));

  function step(){
    ctx.clearRect(0,0,W,H);
    for (const s of stars){
      s.x += s.vx; s.y += s.vy; s.tw += s.ts;
      if (s.y > H) { s.y = -10; s.x = Math.random()*W; }
      if (s.x < -20) s.x = W + 20;
      if (s.x > W + 20) s.x = -20;
      const pulse = 0.6 + 0.4*Math.sin(s.tw);
      ctx.globalAlpha = s.a * pulse;
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r*6);
      grd.addColorStop(0, "rgba(255,240,190,1)");
      grd.addColorStop(1, "rgba(255,240,190,0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r*6, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1; requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();

// ---------- Scroll Fade (sections) ----------
(function initScrollFade(){
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach((e)=>{ if (e.isIntersecting) e.target.classList.add("visible"); });
  }, { threshold: 0.18, rootMargin: "0px 0px -4% 0px" });
  items.forEach(el => obs.observe(el));
})();
