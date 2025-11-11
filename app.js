/* ===========================================
   WORLD BLESSING WALL — FINAL (APP.JS)
   =========================================== */

// ---------- Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection, addDoc, updateDoc, doc,
  serverTimestamp,
  onSnapshot, query, where, orderBy, limit, startAfter,
  getDocs, getCountFromServer
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
const renderedIds = new Set();

function animateCount(el, to){
  if (!el) return;
  const from = Number(el.textContent || 0);
  const duration = 420;
  const t0 = performance.now();
  const tick = (t)=>{
    const p = Math.min(1, (t - t0)/duration);
    el.textContent = Math.round(from + (to - from)*p);
    if(p<1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function detectLang(txt=""){
  const dev = (txt.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (txt.match(/[A-Za-z]/g) || []).length;
  return (dev > 3 && dev > lat) ? "hi" : "en";
}

// Accepts "IN", "IN India", "India"
function normalizeCountry(input=""){
  const raw = input.trim();
  if (!raw) return { country:"", countryCode:"" };

  const map = {
    "india": ["IN","India"], "in": ["IN","India"], "bharat": ["IN","India"],
    "usa": ["US","United States"], "us": ["US","United States"], "united states": ["US","United States"],
    "uae": ["AE","United Arab Emirates"], "dubai": ["AE","United Arab Emirates"],
    "uk": ["GB","United Kingdom"], "england": ["GB","United Kingdom"],
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
    const byCode = Object.values(map).find(([code])=>code===cc);
    return { country: byCode ? byCode[1] : cc, countryCode: cc };
  }

  const key = raw.toLowerCase();
  if (map[key]) return { country: map[key][1], countryCode: map[key][0] };

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
  }catch{ return "🌍"; }
}

async function makeIpHash(){
  const seed = `${navigator.userAgent}::${Intl.DateTimeFormat().resolvedOptions().timeZone}::${Math.random()}`;
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(seed);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  let h=0; for(let i=0;i<seed.length;i++){ h=(h*31+seed.charCodeAt(i))|0; }
  return String(h>>>0);
}

function getGeoOnce(){
  return new Promise(resolve=>{
    if(!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({
        city:"", region:"",
        lat:Number(p.coords.latitude.toFixed(5)),
        lng:Number(p.coords.longitude.toFixed(5))
      }),
      ()=>resolve(null),
      { enableHighAccuracy:false, timeout:2500, maximumAge:600000 }
    );
  });
}

// ---------- Card ----------
function makeCard(docData, docId){
  const data = docData || {};
  const cc = (data.countryCode || "").toUpperCase() || normalizeCountry(data.country||"").countryCode;
  const flag = flagFromCode(cc);

  let timeStr = "";
  try {
    const ts = data.timestamp || data.created;
    timeStr = ts?.toDate ? ts.toDate().toLocaleString() : new Date().toLocaleString();
  } catch { timeStr = new Date().toLocaleString(); }

  const wrap = document.createElement("div");
  wrap.classList.add("blessing-card","fade-up");
  if (docId) wrap.dataset.id = docId;

  // Desktop “IN IN India” issue removed: show emoji + clean name only
  const displayCountry = (data.country || cc || "—");

  wrap.innerHTML = `
    <b><span class="flag">${flag}</span> ${displayCountry}</b>
    <div>${(data.text || "").replace(/\n/g,"<br>")}</div>
    <small>${timeStr}</small>
  `;
  return wrap;
}

function prependIfNew(docSnap){
  const id = docSnap.id;
  if (renderedIds.has(id)) return false;
  blessingsList.prepend(makeCard(docSnap.data(), id));
  renderedIds.add(id);
  return true;
}
function appendIfNew(docSnap){
  const id = docSnap.id;
  if (renderedIds.has(id)) return false;
  blessingsList.appendChild(makeCard(docSnap.data(), id));
  renderedIds.add(id);
  return true;
}

// ---------- Initial load + counter ----------
let lastDoc = null;
let initialLoaded = false;

async function refreshCounter(){
  try{
    const coll = collection(db,"blessings");
    const qCount = query(coll, where("status","==","approved"));
    const snap = await getCountFromServer(qCount);
    animateCount(counterEl, snap.data().count || 0);
  }catch{
    animateCount(counterEl, renderedIds.size);
  }
}

async function loadInitial(){
  const coll = collection(db,"blessings");
  const q1 = query(
    coll,
    where("status","==","approved"),
    orderBy("timestamp","desc"),
    limit(12)
  );

  const snap = await getDocs(q1);
  blessingsList.innerHTML = "";
  snap.docs.forEach(d => appendIfNew(d));
  lastDoc = snap.docs[snap.docs.length - 1] || null;
  initialLoaded = true;

  await refreshCounter();

  if (!lastDoc) {
    loadMoreBtn?.style.setProperty("display","none");
    noMoreEl && (noMoreEl.textContent = "No more blessings 🤍");
  }
  revealOnScroll();
}
loadInitial();

loadMoreBtn?.addEventListener("click", async ()=>{
  if (!lastDoc) return;
  const coll = collection(db,"blessings");
  const qMore = query(
    coll,
    where("status","==","approved"),
    orderBy("timestamp","desc"),
    startAfter(lastDoc),
    limit(12)
  );
  const snap = await getDocs(qMore);

  if (snap.empty){
    loadMoreBtn.style.display = "none";
    noMoreEl && (noMoreEl.textContent = "No more blessings 🤍");
    return;
  }

  snap.docs.forEach(d => appendIfNew(d));
  lastDoc = snap.docs[snap.docs.length - 1] || null;
  revealOnScroll();
});

// ---------- Realtime newest ----------
const liveNewest = query(
  collection(db,"blessings"),
  where("status","==","approved"),
  orderBy("timestamp","desc"),
  limit(1)
);
onSnapshot(liveNewest, (snap)=>{
  if (!initialLoaded) return;
  snap.docChanges().forEach(ch=>{
    if (ch.type === "added") {
      const added = prependIfNew(ch.doc);
      if (added) refreshCounter();
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
      countryCode,
      timestamp: serverTimestamp(),
      created: serverTimestamp(),
      status: "approved",
      device: "web",
      source: document.referrer ? new URL(document.referrer).hostname : "direct",
      language: lang,
      sentimentScore: 0,
      ipHash,
      username: "",
      blessingId: ""
    };

    const ref = await addDoc(collection(db,"blessings"), base);
    await updateDoc(doc(db,"blessings", ref.id), { blessingId: ref.id });

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

    // ✅ Clean success (no red error lingering)
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

// ---------- Particles ----------
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W,H,dpr;
  function resize(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.style.width = W+"px";
    canvas.style.height = H+"px";
    canvas.width = W*dpr; canvas.height = H*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  addEventListener("resize", resize);

  const COUNT = Math.floor((W*H)/28000) + 90;
  const stars = Array.from({length:COUNT}).map(()=>({
    x: Math.random()*W, y: Math.random()*H,
    r: Math.random()*1.4 + 0.4,
    vx: (Math.random()*0.2 - 0.1),
    vy: (Math.random()*0.25 + 0.1),
    tw: Math.random()*Math.PI*2,
    ts: 0.005 + Math.random()*0.008
  }));

  function step(){
    ctx.clearRect(0,0,W,H);
    for(const s of stars){
      s.x += s.vx; s.y += s.vy; s.tw += s.ts;
      if(s.y > H+8){ s.y = -8; s.x = Math.random()*W; }
      const glow = 0.6 + 0.4*Math.sin(s.tw);
      ctx.globalAlpha = glow;
      const g = ctx.createRadialGradient(s.x,s.y,0, s.x,s.y,s.r*7);
      g.addColorStop(0,"rgba(255,240,190,1)");
      g.addColorStop(1,"rgba(255,240,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r*7,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(step);
  }
  step();
})();

// ---------- Scroll fade ----------
function revealOnScroll(){
  const els = document.querySelectorAll(".fade-up, .fade-section");
  const trigger = window.innerHeight * 0.92;
  els.forEach(el=>{
    if (el.getBoundingClientRect().top < trigger) el.classList.add("show");
  });
}
addEventListener("scroll", revealOnScroll);
addEventListener("load", revealOnScroll);
