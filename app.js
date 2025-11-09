// Firebase
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

// Elements
const blessingInput = document.getElementById("blessingInput");
const countryInput  = document.getElementById("countryInput");
const sendBtn       = document.getElementById("sendBtn");
const statusBox     = document.getElementById("status");
const blessingsList = document.getElementById("blessingsList");
const counterEl     = document.getElementById("counter");

// Ripple effect on button
sendBtn.addEventListener("click", (e) => {
  const r = document.createElement("span");
  r.className = "ripple";
  const rect = sendBtn.getBoundingClientRect();
  r.style.left = (e.clientX - rect.left) + "px";
  r.style.top  = (e.clientY - rect.top) + "px";
  sendBtn.appendChild(r);
  setTimeout(() => r.remove(), 650);
});

// Add Blessing
sendBtn.addEventListener("click", async () => {
  const text = blessingInput.value.trim();
  const country = countryInput.value.trim();

  if (!text)  return alert("Write a blessing first 😇");
  if (!country) return alert("Country batao baby 🌍");

  await addDoc(collection(db, "blessings"), {
    text, country, created: serverTimestamp(), approved: true
  });

  statusBox.textContent = "Blessing submitted ✅";
  blessingInput.value = "";
});

// Animated counter
function animateCount(el, to){
  const from = Number(el.textContent || 0);
  const start = performance.now();
  const dur = 600;
  function frame(t){
    const p = Math.min(1, (t - start)/dur);
    el.textContent = Math.floor(from + (to - from)*p);
    if(p<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Live listener
const q = query(collection(db, "blessings"), orderBy("created", "desc"));
onSnapshot(q, (snap) => {
  blessingsList.innerHTML = "";
  animateCount(counterEl, snap.docs.length);

  snap.forEach((doc) => {
    const d = doc.data();
    const card = document.createElement("div");
    card.className = "blessing-card";

    const created = d.created?.toDate
      ? d.created.toDate().toLocaleString()
      : "";

    card.innerHTML = `
      <b>${d.country || "—"}</b><br/>
      ${(d.text || "").replace(/\n/g,"<br>")}
      <br/><small>${created}</small>
    `;
    blessingsList.appendChild(card);
  });
});

// Particles (tiny gold dust)
(function particles(){
  const canvas = document.getElementById("particles");
  const ctx = canvas.getContext("2d");
  let w, h, pxRatio = window.devicePixelRatio || 1;

  const N = 80;
  const dots = [];
  function resize(){
    w = canvas.width  = innerWidth * pxRatio;
    h = canvas.height = innerHeight * pxRatio;
    canvas.style.width  = innerWidth+"px";
    canvas.style.height = innerHeight+"px";
  }
  function init(){
    dots.length = 0;
    for(let i=0;i<N;i++){
      dots.push({
        x: Math.random()*w, y: Math.random()*h,
        r: 0.7 + Math.random()*1.6,
        a: Math.random()*Math.PI*2,
        s: 0.2 + Math.random()*0.6
      });
    }
  }
  function step(){
    ctx.clearRect(0,0,w,h);
    for(const p of dots){
      p.x += Math.cos(p.a)*p.s; p.y += Math.sin(p.a)*p.s;
      if(p.x<0) p.x=w; if(p.x>w) p.x=0;
      if(p.y<0) p.y=h; if(p.y>h) p.y=0;

      const grd = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*6);
      grd.addColorStop(0,"rgba(255,223,138,.9)");
      grd.addColorStop(.4,"rgba(243,201,106,.55)");
      grd.addColorStop(1,"rgba(243,201,106,0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*6,0,Math.PI*2); ctx.fill();
    }
    requestAnimationFrame(step);
  }
  window.addEventListener("resize", ()=>{resize(); init();});
  resize(); init(); step();
})();
