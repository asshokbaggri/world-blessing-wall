/* ===========================================
   WORLD BLESSING WALL — HYBRID ULTRA DELUXE
   =========================================== */

// ---------- Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, startAfter,
  getDocs   // ✅ IMPORTANT FIX
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

let lastDoc = null;
let initialLoaded = false;

// ---------- FLAG ----------
function getFlag(countryName){
  if(!countryName) return "🌍";

  try {
    let c = countryName.trim().slice(0,2).toUpperCase();
    return String.fromCodePoint(
      0x1F1E6 + (c.charCodeAt(0) - 65),
      0x1F1E6 + (c.charCodeAt(1) - 65)
    );
  } catch {
    return "🌍";
  }
}

// ---------- CARD ----------
function makeCard(data) {
  const wrap = document.createElement("div");
  wrap.classList.add("blessing-card", "fade-up");

  const country = data.country || "";
  const text = data.text || "";

  // ✅ FLAG SAFE
  const flag = getFlag(country);

  // ✅ TIMESTAMP SAFE
  let timeStr = "";
  try {
    if (data.created && data.created.toDate) {
      timeStr = data.created.toDate().toLocaleString();
    } else {
      timeStr = new Date().toLocaleString();
    }
  } catch {
    timeStr = new Date().toLocaleString();
  }

  wrap.innerHTML = `
    <b><span class="flag">${flag}</span> ${country}</b>
    <div>${text.replace(/\n/g, "<br>")}</div>
    <small>${timeStr}</small>
  `;

  return wrap;
}


// ---------- COUNTER ----------
function animateCount(el, to){
  const from = Number(el.textContent || 0);
  const duration = 300;
  const start = performance.now();

  function frame(t){
    const p = Math.min(1, (t - start) / duration);
    el.textContent = Math.round(from + (to - from) * p);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------- SUBMIT ----------
async function submitBlessing(){
  const text = blessingInput.value.trim();
  const country = countryInput.value.trim();

  if(!text) return;
  if(!country) return;

  sendBtn.disabled = true;

  await addDoc(collection(db,"blessings"), {
    text, country,
    created: serverTimestamp(),
    approved: true
  });

  blessingInput.value = "";
  statusBox.textContent = "Blessing added ✅";

  setTimeout(()=> statusBox.textContent="",1200);
  sendBtn.disabled = false;
}

sendBtn.addEventListener("click", submitBlessing);

// ---------- FIRST LOAD ----------
async function loadInitial(){
  const q = query(
    collection(db,"blessings"),
    orderBy("created","desc"),
    limit(12)
  );

  const snap = await getDocs(q);

  blessingsList.innerHTML = "";
  snap.docs.forEach(doc => blessingsList.appendChild(makeCard(doc.data())));

  lastDoc = snap.docs[snap.docs.length - 1];
  initialLoaded = true;

  animateCount(counterEl, snap.size);

  if(snap.size < 12){
    loadMoreBtn.style.display = "none";
  }
}

loadInitial();

// ---------- REALTIME LISTENER (TOP 1 NEW MESSAGE) ----------
const liveTop = query(
  collection(db,"blessings"),
  orderBy("created","desc"),
  limit(1)
);

onSnapshot(liveTop, snap => {
  if(!initialLoaded) return;

  snap.docChanges().forEach(change => {
    if(change.type === "added"){
      const data = change.doc.data();

      const newCard = makeCard(data);
      blessingsList.prepend(newCard);

      animateCount(counterEl, Number(counterEl.textContent) + 1);
      revealOnScroll();
    }
  });
});

// ---------- LOAD MORE ----------
loadMoreBtn.addEventListener("click", async ()=>{
  if(!lastDoc) return;

  const q = query(
    collection(db,"blessings"),
    orderBy("created","desc"),
    startAfter(lastDoc),
    limit(12)
  );

  const snap = await getDocs(q);

  if(snap.empty){
    loadMoreBtn.style.display = "none";
    noMoreEl.textContent = "No more blessings 🤍";
    return;
  }

  snap.docs.forEach(doc => blessingsList.appendChild(makeCard(doc.data())));
  lastDoc = snap.docs[snap.docs.length - 1];

  revealOnScroll();
});

// ---------- PARTICLES ----------
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
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

  const COUNT = Math.floor((W*H)/28000) + 90;
  const stars = Array.from({length:COUNT}).map(()=>({
    x: Math.random()*W,
    y: Math.random()*H,
    r: Math.random()*1.4 + 0.4,
    vx: (Math.random()*0.2 - 0.1),
    vy: (Math.random()*0.25 + 0.1),
    tw: Math.random()*Math.PI*2,
    ts: 0.005 + Math.random()*0.008
  }));

  function animate(){
    ctx.clearRect(0,0,W,H);

    for(const s of stars){
      s.x += s.vx;
      s.y += s.vy;
      s.tw += s.ts;

      if(s.y > H) s.y = -10, s.x = Math.random()*W;

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

// ---------- SCROLL FADE ----------
function revealOnScroll(){
  const els = document.querySelectorAll(".fade-up, .fade-section");
  const trigger = window.innerHeight * 0.92;

  els.forEach(el=>{
    if(el.getBoundingClientRect().top < trigger){
      el.classList.add("show");
    }
  });
}
window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);
