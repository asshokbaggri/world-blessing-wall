/* ===========================================
   WORLD BLESSING WALL — HYBRID ULTRA DELUXE (FINAL)
   - Full new schema + backward compat
   - Realtime newest + manual "Load more"
   - Auto language detect (hi/en basic)
   - Country code + flag auto-detect
   - blessingId backfill
   - Safe ipHash (hashed, no raw IP)
   - Optional geo (non-blocking; updates doc if allowed)
   =========================================== */

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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- Utils ----------
const renderedIds = new Set(); // avoid duplicates when realtime prepends

function animateCount(el, to){
  if (!el) return;
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

// Basic lang detector (Devanagari vs Latin)
function detectLang(txt=""){
  const dev = (txt.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (txt.match(/[A-Za-z]/g) || []).length;
  if (dev > 3 && dev > lat) return "hi";
  return "en";
}

// Country normalization: accepts "IN", "IN India", "India"
function normalizeCountry(input=""){
  const raw = input.trim();
  if (!raw) return { country:"", countryCode:"" };

  // Common aliases map -> ISO code + Display name
  const map = {
    "india": ["IN","India"], "in": ["IN","India"],
    "bharat": ["IN","India"],
    "usa": ["US","United States"], "us": ["US","United States"], "united states": ["US","United States"],
    "uae": ["AE","United Arab Emirates"], "dubai": ["AE","United Arab Emirates"],
    "uk": ["GB","United Kingdom"], "england": ["GB","United Kingdom"], "london": ["GB","United Kingdom"],
    "nepal": ["NP","Nepal"], "pakistan": ["PK","Pakistan"], "bangladesh": ["BD","Bangladesh"],
    "sri lanka": ["LK","Sri Lanka"], "china": ["CN","China"], "japan": ["JP","Japan"],
    "germany": ["DE","Germany"], "france": ["FR","France"], "canada": ["CA","Canada"],
    "australia": ["AU","Australia"], "singapore": ["SG","Singapore"], "indonesia": ["ID","Indonesia"]
  };

  const parts = raw.split(/\s+/);
  // If first token looks like a 2-letter code, prefer that
  if (parts[0].length === 2) {
    const cc = parts[0].toUpperCase();
    // Try to map the rest name; else keep rest as name or fallback to cc
    const restName = parts.slice(1).join(" ").trim();
    if (restName) return { country: restName, countryCode: cc };
    // Map common code -> canonical name if known
    const byCode = Object.values(map).find(([code])=>code===cc);
    return { country: byCode ? byCode[1] : cc, countryCode: cc };
  }

  const key = raw.toLowerCase();
  if (map[key]) return { country: map[key][1], countryCode: map[key][0] };

  // Fallback: keep as name, and derive code from first two letters (not always accurate)
  const guess = raw.slice(0,2).toUpperCase().replace(/[^A-Z]/g,"");
  const cc = guess.length===2 ? guess : "";
  return { country: raw, countryCode: cc };
}

function flagFromCode(cc=""){
  if (!cc || cc.length!==2) return "🌍";
  try{
    return String.fromCodePoint(
      0x1F1E6 + (cc.charCodeAt(0) - 65),
      0x1F1E6 + (cc.charCodeAt(1) - 65)
    );
  }catch{
    return "🌍";
  }
}

// Safe ipHash (no raw IP; browser-only hash seed)
async function makeIpHash(){
  const seed = `${navigator.userAgent}::${Intl.DateTimeFormat().resolvedOptions().timeZone}::${Math.random()}`;
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(seed);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  // Fallback simple hash
  let h = 0; for (let i=0;i<seed.length;i++){ h = (h*31 + seed.charCodeAt(i))|0; }
  return String(h >>> 0);
}

// Optional geo grab (non-blocking)
function getGeoOnce(){
  return new Promise(resolve=>{
    if(!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({
        city: "", region: "", // unknown without reverse geocode
        lat: Number(p.coords.latitude.toFixed(5)),
        lng: Number(p.coords.longitude.toFixed(5))
      }),
      () => resolve(null),
      { enableHighAccuracy:false, timeout: 2500, maximumAge: 600000 }
    );
  });
}

// ---------- Card ----------
function makeCard(docData, docId){
  const data = docData || {};
  const country = (data.country || "").trim();
  const cc = (data.countryCode || "").toUpperCase() || normalizeCountry(country).countryCode;
  const flag = flagFromCode(cc);

  let timeStr = "";
  try {
    // prefer new "timestamp", else legacy "created"
    const ts = data.timestamp || data.created;
    timeStr = ts?.toDate ? ts.toDate().toLocaleString() : new Date().toLocaleString();
  } catch {
    timeStr = new Date().toLocaleString();
  }

  const wrap = document.createElement("div");
  wrap.classList.add("blessing-card","fade-up");
  if (docId) wrap.dataset.id = docId;

  wrap.innerHTML = `
    <b><span class="flag">${flag}</span> ${country || (cc || "—")}</b>
    <div>${(data.text || "").replace(/\n/g,"<br>")}</div>
    <small>${timeStr}</small>
  `;
  return wrap;
}

// ---------- Render helpers ----------
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

// ---------- Initial load + pagination ----------
let lastDoc = null;
let initialLoaded = false;

async function loadInitial(){
  const q1 = query(
    collection(db,"blessings"),
    orderBy("timestamp","desc"),
    limit(12)
  );

  const snap = await getDocs(q1);
  blessingsList.innerHTML = "";

  snap.docs.forEach(d => appendIfNew(d));
  lastDoc = snap.docs[snap.docs.length - 1] || null;
  initialLoaded = true;

  // Counter = number loaded (approx). We’ll bump on realtime adds.
  animateCount(counterEl, renderedIds.size);

  if (!lastDoc) {
    loadMoreBtn?.style.setProperty("display","none");
    if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
  }

  revealOnScroll();
}
loadInitial();

loadMoreBtn?.addEventListener("click", async ()=>{
  if (!lastDoc) return;
  const qMore = query(
    collection(db,"blessings"),
    orderBy("timestamp","desc"),
    startAfter(lastDoc),
    limit(12)
  );
  const snap = await getDocs(qMore);

  if (snap.empty){
    loadMoreBtn.style.display = "none";
    if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
    return;
  }

  snap.docs.forEach(d => appendIfNew(d));
  lastDoc = snap.docs[snap.docs.length - 1] || null;
  revealOnScroll();
});

// ---------- Realtime (newest only) ----------
const liveNewest = query(
  collection(db,"blessings"),
  orderBy("timestamp","desc"),
  limit(1)
);

onSnapshot(liveNewest, (snap)=>{
  if (!initialLoaded) return;
  snap.docChanges().forEach(ch=>{
    if (ch.type === "added") {
      const added = prependIfNew(ch.doc);
      if (added) animateCount(counterEl, renderedIds.size);
      revealOnScroll();
    }
  });
});

// ---------- Submit ----------
sendBtn?.addEventListener("click", submitBlessing);
blessingInput?.addEventListener("keydown", (e)=>{
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
});

async function submitBlessing(){
  const rawText = (blessingInput.value || "").trim();
  const rawCountry = (countryInput.value || "").trim();

  if (!rawText){ blessingInput.focus(); return; }
  if (!rawCountry){ countryInput.focus(); return; }

  sendBtn.disabled = true;
  sendBtn.style.opacity = .7;

  try{
    const lang = detectLang(rawText);
    const { country, countryCode } = normalizeCountry(rawCountry);
    const ipHash = await makeIpHash();

    const base = {
      text: rawText,
      country,
      countryCode,                // NEW
      timestamp: serverTimestamp(), // NEW canonical time
      created: serverTimestamp(),   // legacy for backward compat
      status: "approved",         // NEW
      device: "web",              // NEW
      source: document.referrer ? new URL(document.referrer).hostname : "direct", // NEW
      language: lang,             // NEW (basic)
      sentimentScore: 0,          // NEW (placeholder for Phase 2)
      ipHash,                     // NEW (safe hash, not raw IP)
      username: "",               // NEW (optional; future)
      blessingId: ""              // will backfill after add
    };

    // Add doc
    const ref = await addDoc(collection(db,"blessings"), base);

    // Backfill blessingId
    await updateDoc(doc(db,"blessings", ref.id), { blessingId: ref.id });

    // Optional geo update (non-blocking)
    getGeoOnce().then(geo=>{
      if (geo){
        updateDoc(doc(db,"blessings", ref.id), {
          "geo.city": geo.city,
          "geo.region": geo.region,
          "geo.lat": geo.lat,
          "geo.lng": geo.lng
        }).catch(()=>{});
      }
    });

    // UI feedback
    statusBox.textContent = "Blessing submitted ✅";
    statusBox.style.color = "#bfe4c2";
    blessingInput.value = "";
    await sleep(1000);
    statusBox.textContent = "";

  }catch(err){
    statusBox.textContent = "Error: " + (err?.message || "Failed");
    statusBox.style.color = "#ffb4b4";
  }finally{
    sendBtn.disabled = false;
    sendBtn.style.opacity = 1;
  }
}

// ---------- Share ----------
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl  = encodeURIComponent(location.href.split('#')[0]);

waShare?.addEventListener("click", ()=>{
  window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`, "_blank");
});
twShare?.addEventListener("click", ()=>{
  window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`, "_blank");
});
copyShare?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
    copyShare.textContent = "Link Copied ✅";
    await sleep(1200);
    copyShare.textContent = "Copy Link";
  }catch{}
});

// ---------- Particles (gold, full-screen, behind UI) ----------
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H, dpr;
  function resize(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
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
    for (const s of stars){
      s.x += s.vx; s.y += s.vy; s.tw += s.ts;
      if (s.y > H+8){ s.y = -8; s.x = Math.random()*W; }
      const glow = 0.6 + 0.4*Math.sin(s.tw);
      ctx.globalAlpha = glow;
      const g = ctx.createRadialGradient(s.x,s.y,0, s.x,s.y,s.r*7);
      g.addColorStop(0,"rgba(255,240,190,1)");
      g.addColorStop(1,"rgba(255,240,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r*7,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }
  animate();
})();

// ---------- Scroll fade ----------
function revealOnScroll(){
  const els = document.querySelectorAll(".fade-up, .fade-section");
  const trigger = window.innerHeight * 0.92;
  els.forEach(el=>{
    if (el.getBoundingClientRect().top < trigger) el.classList.add("show");
  });
}
window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);
