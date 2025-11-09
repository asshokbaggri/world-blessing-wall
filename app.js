/* ===========================================
   WORLD BLESSING WALL — ULTRA DELUXE FINAL
=========================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, limit, startAfter, getDocs
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
const db = getFirestore(app);

// ---------- DOM ----------
const blessingInput = document.getElementById("blessingInput");
const countryInput  = document.getElementById("countryInput");
const sendBtn       = document.getElementById("sendBtn");
const statusBox     = document.getElementById("status");
const blessingsList = document.getElementById("blessingsList");
const counterEl     = document.getElementById("counter");
const loadMoreBtn   = document.getElementById("loadMore");
const noMoreEl      = document.getElementById("noMore");

let lastVisible = null;
const PAGE_SIZE = 12;

// ---------- FLAGS ----------
const countryFlags = {
  "India":"🇮🇳",
  "USA":"🇺🇸",
  "UK":"🇬🇧",
  "UAE":"🇦🇪",
  "Pakistan":"🇵🇰",
  "Bangladesh":"🇧🇩"
};

function getFlag(country){
  return countryFlags[country] || "🌍";
}

// ---------- MAKE CARD ----------
function makeCard(doc){
  const { text, country, created } = doc.data();

  const card = document.createElement("div");
  card.className = "blessing-card fade-up";

  const time = created?.toDate()
    ? created.toDate().toLocaleString()
    : "";

  card.innerHTML = `
    <b><span class="flag">${getFlag(country)}</span> ${country}</b>
    <div>${text}</div>
    <small>${time}</small>
  `;

  return card;
}

// ---------- INITIAL LOAD ----------
async function loadInitial(){
  const q = query(collection(db,"blessings"), orderBy("created","desc"), limit(PAGE_SIZE));
  const snap = await getDocs(q);

  blessingsList.innerHTML = "";
  snap.forEach(doc => blessingsList.appendChild(makeCard(doc)));

  lastVisible = snap.docs[snap.docs.length - 1];

  animateFade();
  counterEl.textContent = snap.size;
}
loadInitial();

// ---------- LOAD MORE ----------
loadMoreBtn.addEventListener("click", async ()=>{

  if (!lastVisible) return;

  const q = query(
    collection(db,"blessings"),
    orderBy("created","desc"),
    startAfter(lastVisible),
    limit(PAGE_SIZE)
  );

  const snap = await getDocs(q);

  if (snap.empty){
    noMoreEl.textContent = "No more";
    loadMoreBtn.style.display = "none";
    return;
  }

  snap.forEach(doc => blessingsList.appendChild(makeCard(doc)));

  lastVisible = snap.docs[snap.docs.length - 1];

  animateFade();
});

// ---------- SUBMIT ----------
sendBtn.addEventListener("click", async ()=>{
  const text = blessingInput.value.trim();
  const country = countryInput.value.trim();

  if (!text) return;
  if (!country) return;

  await addDoc(collection(db,"blessings"), {
    text, country,
    created: serverTimestamp()
  });

  statusBox.textContent = "Blessing submitted ✅";
  blessingInput.value = "";
});

// ---------- FADE ANIMATION ----------
function animateFade(){
  document.querySelectorAll(".fade-up").forEach(el=>{
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 40){
      el.classList.add("show");
    }
  });
}

window.addEventListener("scroll", animateFade);
window.addEventListener("load", animateFade);

// ---------- PARTICLES (FULL SCREEN SMOOTH) ----------
(function(){
  const canvas = document.getElementById("goldParticles");
  const ctx = canvas.getContext("2d");

  let W, H, dpr;

  function resize(){
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr,dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  const COUNT = 120;
  const stars = [];

  for(let i=0;i<COUNT;i++){
    stars.push({
      x: Math.random()*W,
      y: Math.random()*H,
      r: Math.random()*1.8 + .4,
      vx: (Math.random()-.5)*0.25,
      vy: Math.random()*0.3+0.05
    });
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    stars.forEach(s=>{
      s.x+=s.vx; s.y+=s.vy;
      if(s.y>H) s.y=-10;
      if(s.x>W) s.x=0;
      if(s.x<0) s.x=W;

      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r*4,0,Math.PI*2);
      ctx.fillStyle="rgba(255,240,190,.7)";
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }
  draw();
})();
