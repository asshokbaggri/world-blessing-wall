/* ===========================================
   WORLD BLESSING WALL — APP (ULTRA DELUXE)
   - Firebase submit + realtime feed
   - Smooth total counter
   - WhatsApp / X / Copy share
   - GPU-friendly gold particle field
   =========================================== */

// ---------- Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy
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

// Share buttons (optional in markup)
const waShare   = document.getElementById("waShare");
const twShare   = document.getElementById("twShare");
const copyShare = document.getElementById("copyShare");

// ---------- Helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function animateCount(el, to) {
  if (!el) return;
  const from = Number(el.textContent || 0);
  const dur = 420;
  const t0 = performance.now();
  function tick(t){
    const p = Math.min(1, (t - t0)/dur);
    el.textContent = Math.round(from + (to - from)*p);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function makeCard({ country, text, created }) {
  const wrap = document.createElement("div");

  // Animation class
  wrap.classList.add("fade-up");

  wrap.className = "card";

  const timeStr =
    created?.toDate
      ? created.toDate().toLocaleString()
      : new Date().toLocaleString();

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
    sendBtn.disabled = true;
    sendBtn.style.opacity = .7;

    await addDoc(collection(db, "blessings"), {
      text, country,
      created: serverTimestamp(),
      approved: true
    });

    // visual feedback
    if (statusBox){
      statusBox.textContent = "Blessing submitted ✅";
      statusBox.style.color = "#bfe4c2";
    }
    blessingInput.value = "";
    await sleep(150);
  } catch(err){
    if (statusBox){
      statusBox.textContent = "Error: " + (err?.message || "Failed to submit");
      statusBox.style.color = "#ffb4b4";
    }
    console.error(err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.style.opacity = 1;
  }
}

sendBtn?.addEventListener("click", submitBlessing);

// Enter to submit (Ctrl/Cmd+Enter inside textarea)
blessingInput?.addEventListener("keydown", (e)=>{
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
});

// ---------- Realtime feed ----------
const q = query(collection(db,"blessings"), orderBy("created","desc"));

onSnapshot(q, (snap)=>{
  const docs = snap.docs.map(d=>d.data());
  blessingsList.innerHTML = "";
  docs.forEach(data => blessingsList.appendChild(makeCard(data)));
  animateCount(counterEl, docs.length);
});

// ---------- Share ----------
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl  = encodeURIComponent(location.href.split('#')[0]);

waShare?.addEventListener("click", ()=>{
  window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`,'_blank');
});
twShare?.addEventListener("click", ()=>{
  window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,'_blank');
});
copyShare?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
    copyShare.textContent = "Link Copied ✅";
    await sleep(1200);
    copyShare.textContent = "Copy Link";
  }catch{}
});

// ---------- GOLD PARTICLES (GPU-friendly) ----------
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let W, H;

  function resize(){
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener("resize", resize);

  // particles tuned for perf
  const COUNT = Math.floor((W*H)/38000) + 60; // adaptive
  const stars = Array.from({length:COUNT}).map(()=>({
    x: Math.random()*W,
    y: Math.random()*H,
    r: Math.random()*1.6 + .4,
    a: Math.random()*0.6 + 0.3,
    vx: (Math.random()*0.2 - 0.1),
    vy: (Math.random()*0.15 + 0.02),
    tw: Math.random()*Math.PI*2,
    ts: 0.006 + Math.random()*0.01
  }));

  function step(){
    ctx.clearRect(0,0,W,H);
    for (const s of stars){
      s.x += s.vx;
      s.y += s.vy;
      s.tw += s.ts;

      if (s.y > H + 10) { s.y = -10; s.x = Math.random()*W; }
      if (s.x < -10) s.x = W + 10;
      if (s.x > W + 10) s.x = -10;

      const pulse = 0.6 + 0.4*Math.sin(s.tw);
      ctx.globalAlpha = s.a * pulse;
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r*6);
      grd.addColorStop(0, "rgba(255,240,190,1)");
      grd.addColorStop(1, "rgba(255,240,190,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r*6, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();

// ---------- Optional: ensure halo exists ----------
(function ensureHalo(){
  if (!document.getElementById("goldHalo")){
    const d = document.createElement("div");
    d.id = "goldHalo";
    document.body.prepend(d);
  }
  if (!document.getElementById("goldParticles")){
    const c = document.createElement("canvas");
    c.id = "goldParticles";
    document.body.prepend(c);
  }
})();
