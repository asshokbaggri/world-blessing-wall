/* ===========================================
   WORLD BLESSING WALL — APP (FINAL DELUXE) ✅
   - Firebase submit + paginated feed (Load more)
   - Smooth total counter (uses count API)
   - Scroll fade (cards + sections)
   - Country → Flag emoji (auto)
   - Full-screen gold particles (behind UI)
   =========================================== */

// ---------- Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, limit, startAfter, getDocs, doc, getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getCountFromServer
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
const loadMoreBtn   = document.getElementById("loadMore");
const noMoreEl      = document.getElementById("noMore");

const counterEl     = document.getElementById("counter");
const waShare   = document.getElementById("waShare");
const twShare   = document.getElementById("twShare");
const copyShare = document.getElementById("copyShare");

// ---------- Helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const colBless = collection(db, "blessings");

function animateCount(el, to) {
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

// ---------- Flags ----------
const NAME_TO_ISO = {
  "india":"IN","bharat":"IN",
  "united states":"US","usa":"US","us":"US","america":"US",
  "united kingdom":"GB","uk":"GB","england":"GB","scotland":"GB","wales":"GB",
  "canada":"CA","australia":"AU","new zealand":"NZ",
  "pakistan":"PK","bangladesh":"BD","sri lanka":"LK","nepal":"NP","bhutan":"BT",
  "uae":"AE","saudi arabia":"SA","qatar":"QA","oman":"OM","kuwait":"KW",
  "germany":"DE","france":"FR","spain":"ES","italy":"IT","portugal":"PT",
  "netherlands":"NL","switzerland":"CH","sweden":"SE","norway":"NO","denmark":"DK",
  "japan":"JP","south korea":"KR","china":"CN","singapore":"SG","malaysia":"MY",
  "indonesia":"ID","philippines":"PH","thailand":"TH","vietnam":"VN",
  "nigeria":"NG","south africa":"ZA","kenya":"KE","egypt":"EG",
  "mexico":"MX","brazil":"BR","argentina":"AR","chile":"CL",
  "russia":"RU","turkey":"TR","israel":"IL"
};

function isoToFlag(iso){
  if (!iso || iso.length !== 2) return "";
  const A = 0x1F1E6; // Regional Indicator A
  const upper = iso.toUpperCase();
  return String.fromCodePoint( A + (upper.charCodeAt(0)-65), A + (upper.charCodeAt(1)-65) );
}

function nameToFlag(name){
  if (!name) return { flag:"", iso:"" };
  const key = String(name).trim().toLowerCase();
  const iso = NAME_TO_ISO[key] || NAME_TO_ISO[key.replace(/\./g,'')] || "";
  return { flag: iso ? isoToFlag(iso) : "", iso };
}

function initialsBadge(name){
  const t = (name||"").trim().toUpperCase().slice(0,2) || "🌍";
  return `<span class="flag" aria-hidden="true">${t}</span>`;
}

// ---------- Scroll Fade (sections + cards) ----------
const fadeObs = new IntersectionObserver((entries)=>{
  for (const e of entries){
    if (e.isIntersecting) {
      e.target.classList.add("show");
      fadeObs.unobserve(e.target);
    }
  }
}, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });

function armFadeFor(selector){
  document.querySelectorAll(selector).forEach(el=>fadeObs.observe(el));
}

// ---------- Render one card ----------
function makeCard({ country, text, created }) {
  const wrap = document.createElement("div");
  wrap.className = "blessing-card fade-up";

  const { flag } = nameToFlag(country);
  const timeStr =
    created?.toDate ? created.toDate().toLocaleString() : new Date().toLocaleString();

  wrap.innerHTML = `
    <b>${flag ? `<span class="flag">${flag}</span>` : initialsBadge(country)} ${country || ""}</b>
    <div>${(text || "").replace(/\n/g, "<br>")}</div>
    <small>${timeStr}</small>
  `;
  return wrap;
}

// ---------- Pagination state ----------
const PAGE_SIZE = 12;
let lastDoc = null;
let reachedEnd = false;

// Fetch and render a page
async function loadPage(first=false){
  if (reachedEnd) return;

  const baseQ = query(colBless, orderBy("created","desc"), limit(PAGE_SIZE));
  const qPaginated = lastDoc ? query(colBless, orderBy("created","desc"), startAfter(lastDoc), limit(PAGE_SIZE)) : baseQ;

  const snap = await getDocs(qPaginated);
  const docs = snap.docs;
  if (first) blessingsList.innerHTML = "";

  docs.forEach(d => blessingsList.appendChild(makeCard(d.data())));

  // Fade arm the new cards
  armFadeFor(".fade-up");

  if (docs.length < PAGE_SIZE){
    reachedEnd = true;
    loadMoreBtn.style.display = "none";
    noMoreEl.textContent = "No more";
  } else {
    lastDoc = docs[docs.length-1];
    loadMoreBtn.style.display = "block";
    noMoreEl.textContent = "";
  }
}

// ---------- Total counter ----------
async function refreshCount(){
  try{
    const snapshot = await getCountFromServer(colBless);
    animateCount(counterEl, snapshot.data().count || 0);
  }catch{
    // silent
  }
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

    await addDoc(colBless, {
      text, country,
      created: serverTimestamp(),
      approved: true
    });

    statusBox.textContent = "Blessing submitted ✅";
    statusBox.style.color = "#bfe4c2";

    blessingInput.value = "";
    await sleep(150);

    // refresh top of feed
    lastDoc = null;
    reachedEnd = false;
    await loadPage(true);
    await refreshCount();

  }catch(err){
    statusBox.textContent = "Error: " + (err?.message || "Failed to submit");
    statusBox.style.color = "#ffb4b4";
  }finally{
    sendBtn.disabled = false;
    sendBtn.style.opacity = 1;
  }
}

sendBtn?.addEventListener("click", submitBlessing);
blessingInput?.addEventListener("keydown", (e)=>{
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
});

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

// ---------- Load more ----------
loadMoreBtn?.addEventListener("click", ()=> loadPage(false));

/* =======================================================
   GOLD PARTICLES — Full-screen behind everything
   (GPU-light radial glow dots)
   ======================================================= */
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let W, H;

  function resize(){
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener("resize", resize);

  const COUNT = Math.floor((W*H)/28000) + 90; // adaptive
  const stars = Array.from({length:COUNT}).map(()=>({
    x: Math.random()*W,
    y: Math.random()*H,
    r: Math.random()*1.4 + 0.5,
    a: Math.random()*0.7 + 0.3,
    vx: (Math.random()*0.2 - 0.1),
    vy: (Math.random()*0.18 + 0.04),
    tw: Math.random()*Math.PI*2,
    ts: 0.006 + Math.random()*0.012
  }));

  function step(){
    ctx.clearRect(0,0,W,H);
    for (const s of stars){
      s.x += s.vx;
      s.y += s.vy;
      s.tw += s.ts;

      if (s.y > H) { s.y = -10; s.x = Math.random()*W; }
      if (s.x < -20) s.x = W + 20;
      if (s.x > W + 20) s.x = -20;

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

/* ---------- Boot ---------- */
window.addEventListener("DOMContentLoaded", async ()=>{
  // Arm fade for sections that exist on page
  armFadeFor(".fade-section, .fade-up");

  // Initial data
  await refreshCount();
  await loadPage(true);
});
