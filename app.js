/* ============================================================
   WORLD BLESSING WALL — APP.JS (FINAL CLEAN BUILD)
   - Firebase
   - Username Modal
   - Infinite Scroll
   - Viral Cards
   - My Blessings (Realtime)
   - Sparkles, Toast, Animations
   - NO DUPLICATE FUNCTIONS
   ============================================================ */

/* ---------- Firebase ---------- */
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

/* ---------- DOM ---------- */
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

// My Blessings
const myList = document.getElementById("myBlessingsList");
const myEmpty = document.getElementById("myEmpty");
const toggleMy = document.getElementById("toggleMy");
const refreshMy = document.getElementById("refreshMy");
const myCountEl = document.getElementById("myCount");

// Username Modal DOM
const usernamePopup = document.getElementById("usernamePopup");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsername");
const skipUsernameBtn = document.getElementById("skipUsername");

// Micro animation DOM
let sparkleRoot = document.getElementById("sparkleBurst");
let liveToast   = document.getElementById("liveToast");
const titleEl   = document.querySelector(".title");

/* ---------- sleep util ---------- */
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

/* ---------- STATE ---------- */
const renderedIds = new Set();
let lastDoc = null;
let loadingMore = false;
let initialLoaded = false;
const PAGE_LIMIT = 12;

/* ---------- CLIENT ID ---------- */
function getClientId(){
  try {
    const key = "wbw_client_id_v1";
    let id = localStorage.getItem(key);
    if (id) return id;

    const arr = crypto.getRandomValues(new Uint8Array(12));
    id = [...arr].map(b=>b.toString(16).padStart(2,"0")).join("");
    localStorage.setItem(key,id);
    return id;
  } catch {
    const id = "x"+Date.now().toString(36);
    try { localStorage.setItem("wbw_client_id_v1",id); } catch{}
    return id;
  }
}
const CLIENT_ID = getClientId();

/* ---------- HASH ---------- */
async function makeIpHash(){
  const seed = `${CLIENT_ID}::${navigator.userAgent}::${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

  if (crypto?.subtle){
    try {
      const data = new TextEncoder().encode(seed);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
    } catch {}
  }

  let h = 0;
  for (let i=0;i<seed.length;i++){
    h = (h*31 + seed.charCodeAt(i))|0;
  }
  return String(h>>>0);
}

/* ---------- UTILS ---------- */
function escapeHTML(s=""){
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function detectLang(txt=""){
  const dev = (txt.match(/[\u0900-\u097F]/g)||[]).length;
  const lat = (txt.match(/[A-Za-z]/g)||[]).length;
  return (dev>3 && dev>lat) ? "hi":"en";
}

function normalizeCountry(raw=""){
  raw = raw.trim();
  if(!raw) return {country:"", countryCode:""};

  const map = {
    "india":["IN","India"], "bharat":["IN","India"],
    "in":["IN","India"],
    "usa":["US","United States"], "us":["US","United States"],
    "uae":["AE","United Arab Emirates"], "dubai":["AE","United Arab Emirates"],
    "uk":["GB","United Kingdom"], "england":["GB","United Kingdom"]
  };

  const parts = raw.split(/\s+/);
  if(parts[0].length===2){
    const cc = parts[0].toUpperCase();
    const rest = parts.slice(1).join(" ");
    return {country:rest || cc, countryCode:cc};
  }

  const key = raw.toLowerCase();
  if(map[key]) return {country:map[key][1], countryCode:map[key][0]};

  return {country:raw, countryCode:raw.slice(0,2).toUpperCase()};
}

function flagFromCode(cc=""){
  if(!cc || cc.length!==2) return "🌍";
  try {
    return String.fromCodePoint(
      0x1F1E6+(cc.charCodeAt(0)-65),
      0x1F1E6+(cc.charCodeAt(1)-65)
    );
  } catch { return "🌍"; }
}

/* ---------- GEO ---------- */
function getGeoOnce(){
  return new Promise(resolve=>{
    if(!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(pos=>{
      resolve({
        lat:+pos.coords.latitude.toFixed(5),
        lng:+pos.coords.longitude.toFixed(5)
      });
    },()=>resolve(null),{timeout:2200});
  });
}

/* ---------- ANIM ---------- */
function pulseSendBtn(){
  sendBtn.classList.add("pulse");
  setTimeout(()=>sendBtn.classList.remove("pulse"),900);
}

function showLiveToast(txt="✨ Your blessing is live!"){
  document.getElementById("liveToastText").textContent = txt;
  liveToast.hidden = false;
  liveToast.classList.add("show");
  setTimeout(()=>{
    liveToast.classList.remove("show");
    setTimeout(()=> liveToast.hidden=true, 300);
  },1100);
}

function triggerSparkle(count=12){
  const w = innerWidth;
  const x0 = w/2;
  const y0 = innerHeight*0.42;

  for(let i=0;i<count;i++){
    const sp = document.createElement("div");
    sp.className = "wbw-spark";
    const angle = Math.random()*Math.PI*2;
    const dist = 60 + Math.random()*140;
    const tx = Math.cos(angle)*dist + "px";
    const ty = Math.sin(angle)*dist - (20+Math.random()*40) + "px";
    sp.style.setProperty("--tx", tx);
    sp.style.setProperty("--ty", ty);
    sp.style.left = (x0-6+(Math.random()*24-12))+"px";
    sp.style.top  = (y0-6+(Math.random()*24-12))+"px";
    sparkleRoot.appendChild(sp);
    setTimeout(()=>sp.remove(),900);
  }
}

/* ---------- Counter Animation ---------- */
function animateCount(el,to){
  const from = Number(el.textContent||0);
  const duration = 380;
  const start = performance.now();

  el.classList.remove("counter-anim");
  void el.offsetWidth;
  el.classList.add("counter-anim");

  function frame(t){
    const p = Math.min(1,(t-start)/duration);
    el.textContent = Math.round(from+(to-from)*p);
    if(p<1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- TIME AGO ---------- */
function timeAgo(ts){
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now()-date)/1000);

  if (sec<60) return `${sec} seconds ago`;
  const min = Math.floor(sec/60);
  if (min<60) return `${min} minutes ago`;
  const hr = Math.floor(min/60);
  if (hr<24) return `${hr} hours ago`;
  const day = Math.floor(hr/24);
  if (day<7) return `${day} days ago`;

  return date.toLocaleDateString(undefined,{month:"short",day:"numeric"});
}

/* ---------- CARD BUILDER ---------- */
function makeCard(data={}, id){
  const country = data.country||"";
  const cc = data.countryCode||"";
  const flag = flagFromCode(cc);
  const username = data.username||"";
  const rel = timeAgo(data.timestamp||data.created);

  const el = document.createElement("div");
  el.classList.add("blessing-card","fade-up");
  if(id) el.dataset.id=id;

  el.innerHTML = `
    <b class="blessing-flag"><span class="flag">${flag}</span> ${escapeHTML(country)}</b>
    <div class="blessing-text">${escapeHTML(data.text||"").replace(/\n/g,"<br>")}</div>
    ${username ? `<div class="blessing-user">— ${escapeHTML(username)}</div>` : ""}
    <div class="blessing-time">${escapeHTML(rel)}</div>
  `;
  return el;
}

/* ---------- RENDER HELPERS ---------- */
function prependIfNew(snap){
  if(renderedIds.has(snap.id)) return false;
  blessingsList.prepend(makeCard(snap.data(),snap.id));
  renderedIds.add(snap.id);
  return true;
}

function appendIfNew(snap){
  if(renderedIds.has(snap.id)) return false;
  blessingsList.appendChild(makeCard(snap.data(),snap.id));
  renderedIds.add(snap.id);
  return true;
}

/* ---------- INITIAL LOAD ---------- */
async function loadInitial(){
  const q1 = query(collection(db,"blessings"), orderBy("timestamp","desc"), limit(PAGE_LIMIT));
  const snap = await getDocs(q1);

  blessingsList.innerHTML="";
  renderedIds.clear();

  snap.docs.forEach(d=>appendIfNew(d));
  lastDoc = snap.docs[snap.docs.length-1]||null;
  initialLoaded=true;

  animateCount(counterEl, renderedIds.size);

  if(!lastDoc){
    loadMoreBtn.style.display="none";
    noMoreEl.textContent="No more blessings 🤍";
  }

  revealOnScroll();
  setupInfiniteObserver();
}

loadInitial();

/* ---------- LOAD MORE ---------- */
async function loadMore(){
  if(loadingMore||!lastDoc) return;
  loadingMore=true;
  loadMoreBtn.disabled=true;

  const qMore = query(
    collection(db,"blessings"),
    orderBy("timestamp","desc"),
    startAfter(lastDoc),
    limit(PAGE_LIMIT)
  );

  const snap = await getDocs(qMore);

  if(snap.empty){
    lastDoc=null;
    loadMoreBtn.style.display="none";
    noMoreEl.textContent="No more blessings 🤍";
  } else {
    snap.docs.forEach(d=>appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length-1]||null;
    revealOnScroll();
  }

  loadingMore=false;
  loadMoreBtn.disabled=false;
}

loadMoreBtn.addEventListener("click",loadMore);

/* ---------- INFINITE SCROLL ---------- */
let infiniteObserver=null;
let sentinel=null;

function createSentinel(){
  const ex = document.getElementById("wbw_sentinel");
  if(ex) return ex;

  const s = document.createElement("div");
  s.id="wbw_sentinel";
  s.style.width="1px";
  s.style.height="1px";
  s.style.margin="1px auto";
  blessingsList.insertAdjacentElement("afterend",s);
  return s;
}

function setupInfiniteObserver(){
  if(infiniteObserver) return;
  sentinel = createSentinel();

  infiniteObserver = new IntersectionObserver(async entries=>{
    for(const e of entries){
      if(e.isIntersecting && initialLoaded && !loadingMore && lastDoc){
        await loadMore();
      }
    }
  }, {rootMargin:"400px"});

  infiniteObserver.observe(sentinel);
}

/* ---------- REALTIME NEWEST ---------- */
const qNewest = query(
  collection(db,"blessings"),
  orderBy("timestamp","desc"),
  limit(1)
);

onSnapshot(qNewest,(snap)=>{
  if(!initialLoaded) return;

  snap.docChanges().forEach(c=>{
    if(c.type==="added"){
      const added = prependIfNew(c.doc);
      if(added){
        animateCount(counterEl, renderedIds.size);
        triggerSparkle(10);
      }
      revealOnScroll();
    }
  });
});

/* ---------- USERNAME MODAL ---------- */
function openUsernamePopup(){
  usernamePopup.removeAttribute("hidden");
  usernamePopup.classList.add("show");
  setTimeout(()=>usernameInput.focus(),60);
}

function closeUsernamePopup(){
  usernamePopup.classList.remove("show");
  setTimeout(()=>usernamePopup.setAttribute("hidden",""),180);
}

function getSavedUsername(){
  return (localStorage.getItem("wbw_username_v1")||"").trim();
}

function ensureUsernameModal(){
  const saved = getSavedUsername();
  if(saved) return Promise.resolve(saved);

  openUsernamePopup();

  return new Promise(resolve=>{
    saveUsernameBtn.onclick = ()=>{
      const val = usernameInput.value.trim();
      if(!val){
        alert("Naam khaali nahi ho sakta ❤️");
        return;
      }
      localStorage.setItem("wbw_username_v1", val);
      closeUsernamePopup();
      resolve(val);
    };

    skipUsernameBtn.onclick = ()=>{
      alert("Blessing post karne ke liye naam zaroori hai 🙏");
      resolve(null);
    };
  });
}

/* ---------- MY BLESSINGS ---------- */
let myUnsub=null;

async function startMyBlss(){
  myList.innerHTML="";
  myEmpty.textContent="Loading…";

  const hash = await makeIpHash();
  const qMy = query(
    collection(db,"blessings"),
    where("ipHash","==",hash),
    orderBy("timestamp","desc"),
    limit(60)
  );

  if(myUnsub) myUnsub();

  myUnsub = onSnapshot(qMy,(snap)=>{
    myList.innerHTML="";

    if(snap.empty){
      myEmpty.textContent="You haven't posted any blessings yet 🌟";
      animateCount(myCountEl,0);
      return;
    }

    myEmpty.textContent="";
    snap.docs.forEach(d=>myList.appendChild(makeCard(d.data(), d.id)));
    animateCount(myCountEl,snap.docs.length);
  },()=>{
    myEmpty.textContent="Unable to load your blessings.";
  });
}

startMyBlss();

toggleMy.onclick=()=>{
  const sec = document.getElementById("myBlessings");
  if(sec.style.display==="none"){
    sec.style.display="";
    toggleMy.textContent="Hide My Blessings";
  } else {
    sec.style.display="none";
    toggleMy.textContent="Show My Blessings";
  }
};

refreshMy.onclick=startMyBlss;

/* ---------- SUBMIT ---------- */
sendBtn.addEventListener("click",submitBlessing);

blessingInput.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==="Enter") submitBlessing();
});

async function submitBlessing(){
  const text = blessingInput.value.trim();
  const rawCountry = countryInput.value.trim();

  if(!text){ blessingInput.focus(); return; }
  if(!rawCountry){ countryInput.focus(); return; }

  sendBtn.disabled=true;
  sendBtn.style.opacity=".6";

  const username = await ensureUsernameModal();
  if(!username){
    statusBox.textContent="Posting cancelled — name required.";
    statusBox.style.color="#ffb4b4";
    sendBtn.disabled=false;
    sendBtn.style.opacity="1";
    return;
  }

  const lang = detectLang(text);
  const {country,countryCode} = normalizeCountry(rawCountry);
  const hash = await makeIpHash();

  const base = {
    text, country, countryCode,
    timestamp:serverTimestamp(),
    created:serverTimestamp(),
    language:lang,
    ipHash:hash,
    username,
    sentimentScore:0,
    device:"web",
    status:"approved",
    source:document.referrer ? new URL(document.referrer).hostname : "direct",
    blessingId:""
  };

  const ref = await addDoc(collection(db,"blessings"), base);
  updateDoc(doc(db,"blessings",ref.id), {blessingId:ref.id}).catch(()=>{});

  getGeoOnce().then(g=>{
    if(g){
      updateDoc(doc(db,"blessings",ref.id),{
        "geo.lat":g.lat,
        "geo.lng":g.lng
      }).catch(()=>{});
    }
  });

  pulseSendBtn();
  triggerSparkle(14);
  showLiveToast("✨ Your blessing is live!");

  blessingInput.value="";
  await sleep(900);
  statusBox.textContent="";
  startMyBlss();

  sendBtn.disabled=false;
  sendBtn.style.opacity="1";
}

/* ---------- SHARE ---------- */
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl  = encodeURIComponent(location.href.split("#")[0]);

waShare.onclick = ()=>{
  window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`,"_blank");
};

twShare.onclick = ()=>{
  window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,"_blank");
};

copyShare.onclick = async ()=>{
  await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
  const prev = copyShare.textContent;
  copyShare.textContent="Link Copied ✅";
  await sleep(1000);
  copyShare.textContent=prev;
};

/* ---------- PARTICLES ---------- */
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  if(!canvas) return;

  const ctx = canvas.getContext("2d");
  let W,H,dpr;

  function resize(){
    dpr = Math.min(2,devicePixelRatio||1);
    W = innerWidth;
    H = innerHeight;
    canvas.style.width=W+"px";
    canvas.style.height=H+"px";
    canvas.width=W*dpr;
    canvas.height=H*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  addEventListener("resize",resize);

  const COUNT=Math.floor((W*H)/28000)+90;

  const stars = Array.from({length:COUNT}).map(()=>({
    x:Math.random()*W,
    y:Math.random()*H,
    r:Math.random()*1.5+0.4,
    vx:Math.random()*0.2-0.1,
    vy:Math.random()*0.25+0.1,
    tw:Math.random()*Math.PI*2,
    ts:0.005+Math.random()*0.008
  }));

  function animate(){
    ctx.clearRect(0,0,W,H);
    for(const s of stars){
      s.x+=s.vx;
      s.y+=s.vy;
      s.tw+=s.ts;

      if(s.y>H+8){
        s.y=-8;
        s.x=Math.random()*W;
      }

      const glow=0.55+0.4*Math.sin(s.tw);
      ctx.globalAlpha=glow;

      const g = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*7);
      g.addColorStop(0,"rgba(255,240,190,1)");
      g.addColorStop(1,"rgba(255,240,190,0)");
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r*7,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ---------- REVEAL ---------- */
function revealOnScroll(){
  const els = document.querySelectorAll(".fade-up,.fade-section");
  const trig = innerHeight*0.92;

  els.forEach(el=>{
    if(el.getBoundingClientRect().top < trig){
      el.classList.add("show");
    }
  });
}

addEventListener("scroll",revealOnScroll);
addEventListener("load",revealOnScroll);

console.info("World Blessing Wall — Final Clean JS Loaded");
