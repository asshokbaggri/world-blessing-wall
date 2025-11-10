/* ===========================================
   WORLD BLESSING WALL — HYBRID ULTRA DELUXE
   =========================================== */

// ---------- Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, startAfter
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

const loadMoreBtn = document.getElementById("loadMore");
const noMoreEl    = document.getElementById("noMore");

const waShare   = document.getElementById("waShare");
const twShare   = document.getElementById("twShare");
const copyShare = document.getElementById("copyShare");

let lastDoc = null;
let firstLoad = true;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- COUNTRY FLAG ----------
function getFlag(countryName){
  try {
    let code = countryName.trim().slice(0,2).toUpperCase();
    if(code.length < 2) return "🌍";
    return String.fromCodePoint(
      0x1F1E6 + (code.charCodeAt(0) - 65),
      0x1F1E6 + (code.charCodeAt(1) - 65)
    );
  } catch {
    return "🌍";
  }
}

// ---------- COUNTER ----------
function animateCount(el, to) {
  const from = Number(el.textContent || 0);
  const dur = 420;
  const t0 = performance.now();
  function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(from + (to - from) * p);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- CARD ----------
function makeCard({ country, text, created }) {
  const wrap = document.createElement("div");
  wrap.classList.add("blessing-card", "fade-up");

  const flag = getFlag(country || "");
  const timeStr = created?.toDate
    ? created.toDate().toLocaleString()
    : new Date().toLocaleString();

  wrap.innerHTML = `
    <b><span class="flag">${flag}</span> ${country || "—"}</b>
    <div>${(text || "").replace(/\n/g, "<br>")}</div>
    <small>${timeStr}</small>
  `;
  return wrap;
}

// ---------- SUBMIT ----------
async function submitBlessing() {
  const text = blessingInput.value.trim();
  const country = (countryInput.value || "").trim();

  if (!text) return blessingInput.focus();
  if (!country) return countryInput.focus();

  try {
    sendBtn.disabled = true;
    sendBtn.style.opacity = .7;

    await addDoc(collection(db, "blessings"), {
      text, country,
      created: serverTimestamp(),
      approved: true
    });

    statusBox.textContent = "Blessing submitted ✅";
    statusBox.style.color = "#bfe4c2";
    blessingInput.value = "";

  } catch (err) {
    statusBox.textContent = "Error: " + (err?.message || "Failed");
    statusBox.style.color = "#ffb4b4";
  } finally {
    sendBtn.disabled = false;
    sendBtn.style.opacity = 1;
  }
}

sendBtn?.addEventListener("click", submitBlessing);

blessingInput?.addEventListener("keydown", (e)=>{
  if((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
});

// ---------- INITIAL LOAD (LIMITED) ----------
async function loadInitial(){
  const qLimited = query(
    collection(db,"blessings"),
    orderBy("created","desc"),
    limit(12)
  );

  onSnapshot(qLimited, (snap)=>{
    if(!firstLoad) return; // prevents duplicate renders
    firstLoad = false;

    blessingsList.innerHTML = "";
    snap.docs.forEach(doc => blessingsList.appendChild(makeCard(doc.data())));

    lastDoc = snap.docs[snap.docs.length - 1];
    animateCount(counterEl, snap.size);

    revealOnScroll(); // show fade
  });
}
loadInitial();

// ---------- LOAD MORE ----------
loadMoreBtn?.addEventListener("click", async ()=>{
  if(!lastDoc) return;

  const qMore = query(
    collection(db,"blessings"),
    orderBy("created","desc"),
    startAfter(lastDoc),
    limit(12)
  );

  const snap = await getDocs(qMore);

  if(snap.empty){
    noMoreEl.textContent = "No more blessings 🤍";
    loadMoreBtn.style.display = "none";
    return;
  }

  snap.docs.forEach(doc => blessingsList.appendChild(makeCard(doc.data())));
  lastDoc = snap.docs[snap.docs.length - 1];

  revealOnScroll();
});

// ---------- SHARE ----------
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl  = encodeURIComponent(location.href.split('#')[0]);

waShare?.addEventListener("click", ()=> {
  window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`, "_blank");
});
twShare?.addEventListener("click", ()=> {
  window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`, "_blank");
});
copyShare?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
    copyShare.textContent = "Link Copied ✅";
    await sleep(1200);
    copyShare.textContent = "Copy Link";
  } catch {}
});

// ---------- PARTICLES ----------
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  const ctx = canvas.getContext("2d");
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let W, H;

  function resize(){
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
  const stars = Array.from({length:COUNT}).map(()=>({
    x: Math.random()*W,
    y: Math.random()*H,
    r: Math.random()*1.4 + 0.5,
    a: Math.random()*0.7 + 0.3,
    vx: (Math.random()*0.2 - 0.1),
    vy: (Math.random()*0.18 + 0.04),
    tw: Math.random()*Math.PI*2,
    ts: 0.006 + Math.random()*0.01
  }));

  function step(){
    ctx.clearRect(0,0,W,H);

    for(const s of stars){
      s.x += s.vx;
      s.y += s.vy;
      s.tw += s.ts;

      if(s.y > H) s.y = -10, s.x = Math.random()*W;
      if(s.x < -20) s.x = W + 20;
      if(s.x > W + 20) s.x = -20;

      const pulse = 0.6 + 0.4*Math.sin(s.tw);
      ctx.globalAlpha = s.a * pulse;

      const g = ctx.createRadialGradient(s.x,s.y,0, s.x,s.y,s.r*6);
      g.addColorStop(0,"rgba(255,240,190,1)");
      g.addColorStop(1,"rgba(255,240,190,0)");
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r*6,0,Math.PI*2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();

// ---------- SCROLL FADE ----------
function revealOnScroll(){
  const els = document.querySelectorAll(".fade-up, .fade-section");
  const trigger = window.innerHeight * 0.92;

  els.forEach(el=>{
    const rect = el.getBoundingClientRect();
    if(rect.top < trigger) el.classList.add("show");
  });
}
window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);
