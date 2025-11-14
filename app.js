/* ============================================================
   WORLD BLESSING WALL — APP.JS  (PART 1/4)
   - Top section: Firebase init, DOM refs, state, clientId/ipHash
   - Utility helpers, geo, micro-animation helpers
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

// my-blessings DOM
const myList = document.getElementById("myBlessingsList");
const myEmpty = document.getElementById("myEmpty");
const toggleMy = document.getElementById("toggleMy");
const refreshMy = document.getElementById("refreshMy");
const myCountEl = document.getElementById("myCount");

// Username modal DOM (modal HTML must exist in index.html)
const usernamePopup = document.getElementById("usernamePopup");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsername");
const skipUsernameBtn = document.getElementById("skipUsername");

// micro-animation targets
let sparkleRoot = document.getElementById("sparkleBurst");
let liveToast   = document.getElementById("liveToast");
const titleEl   = document.querySelector(".title");

/* ---------- tiny util ----------
   sleep is used for small UX delays
*/
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- STATE ---------- */
const renderedIds = new Set(); // public feed DOM ids
let lastDoc = null;
let initialLoaded = false;
let loadingMore = false; // guard pagination
const PAGE_LIMIT = 12;

/* --------- CLIENT ID (persistent) & ipHash strategy ---------
   - persistent client id stored in localStorage (wbw_client_id_v1)
   - ipHash = sha256(CLIENT_ID + UA + timezone) when subtle available
   - stable enough to link "My Blessings" to the same browser
*/
function getClientId(){
  try {
    const key = "wbw_client_id_v1";
    let id = localStorage.getItem(key);
    if (id) return id;
    // generate random 12-byte id hex
    const arr = crypto.getRandomValues(new Uint8Array(12));
    id = [...arr].map(b=>b.toString(16).padStart(2,"0")).join("");
    localStorage.setItem(key, id);
    return id;
  } catch(e){
    // fallback to timestamp
    const id = "x" + Date.now().toString(36);
    try { localStorage.setItem("wbw_client_id_v1", id); } catch {}
    return id;
  }
}
const CLIENT_ID = getClientId();

async function makeIpHash(){
  const seed = `${CLIENT_ID}::${navigator.userAgent}::${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  if (crypto?.subtle) {
    try {
      const data = new TextEncoder().encode(seed);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
    } catch(e){
      // fallthrough to simple hash
    }
  }
  // simple numeric fallback (not cryptographic; just stable)
  let h = 0;
  for (let i=0;i<seed.length;i++){
    h = (h*31 + seed.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

/* ---------- Utils ---------- */

// escape HTML when inserting into innerHTML (we still use some innerHTML for markup)
function escapeHTML(s = ""){
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// basic language detection (Devanagari vs Latin)
function detectLang(txt = ""){
  const dev = (txt.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (txt.match(/[A-Za-z]/g) || []).length;
  if (dev > 3 && dev > lat) return "hi";
  return "en";
}

// normalize country input -> { country, countryCode }
function normalizeCountry(input = ""){
  const raw = (input || "").trim();
  if (!raw) return { country:"", countryCode:"" };

  const map = {
    "india": ["IN","India"], "in": ["IN","India"], "bharat": ["IN","India"],
    "usa": ["US","United States"], "us": ["US","United States"], "united states": ["US","United States"],
    "uae": ["AE","United Arab Emirates"], "dubai": ["AE","United Arab Emirates"],
    "uk": ["GB","United Kingdom"], "england": ["GB","United Kingdom"], "london": ["GB","United Kingdom"],
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
    const byCode = Object.values(map).find(([code]) => code === cc);
    return { country: byCode ? byCode[1] : cc, countryCode: cc };
  }

  const key = raw.toLowerCase();
  if (map[key]) return { country: map[key][1], countryCode: map[key][0] };

  const guess = raw.slice(0,2).toUpperCase().replace(/[^A-Z]/g,"");
  const cc = guess.length === 2 ? guess : "";
  return { country: raw, countryCode: cc };
}

// generate emoji flag from ISO code (two letters)
function flagFromCode(cc = ""){
  if (!cc || cc.length !== 2) return "🌍";
  try {
    return String.fromCodePoint(
      0x1F1E6 + (cc.charCodeAt(0) - 65),
      0x1F1E6 + (cc.charCodeAt(1) - 65)
    );
  } catch {
    return "🌍";
  }
}

// Non-blocking one-shot geo (returns {lat,lng} or null) — doesn't block submit
function getGeoOnce(){
  return new Promise(resolve=>{
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        city: "", region: "",
        lat: Number(pos.coords.latitude.toFixed(5)),
        lng: Number(pos.coords.longitude.toFixed(5))
      }),
      () => resolve(null),
      { enableHighAccuracy:false, timeout:2500, maximumAge:600000 }
    );
  });
}

/* ---------- Micro-animation helpers ---------- */
function pulseSendBtn(){
  if (!sendBtn) return;
  sendBtn.classList.add("pulse");
  setTimeout(()=> sendBtn.classList.remove("pulse"), 900);
}

function showLiveToast(text = "✨ Your blessing is live!"){
  try {
    const txtEl = document.getElementById("liveToastText");
    if (txtEl) txtEl.textContent = text;
    liveToast.hidden = false;
    liveToast.classList.add("show");
    setTimeout(()=> {
      liveToast.classList.remove("show");
      setTimeout(()=> liveToast.hidden = true, 300);
    }, 1100);
  } catch(e){}
}

function triggerSparkle(count = 12){
  if (!sparkleRoot) return;
  const w = window.innerWidth;
  const x0 = Math.round(w/2);
  const y0 = Math.round(window.innerHeight * 0.42);

  for (let i=0;i<count;i++){
    const sp = document.createElement("div");
    sp.className = "wbw-spark";
    const angle = Math.random()*Math.PI*2;
    const dist = 60 + Math.random()*140;
    const tx = Math.round(Math.cos(angle)*dist) + "px";
    const ty = Math.round(Math.sin(angle)*dist - (20 + Math.random()*40)) + "px";
    sp.style.setProperty("--tx", tx);
    sp.style.setProperty("--ty", ty);
    sp.style.left = (x0 - 6 + (Math.random()*24-12)) + "px";
    sp.style.top  = (y0 - 6 + (Math.random()*24-12)) + "px";
    sparkleRoot.appendChild(sp);
    setTimeout(()=> { try{ sp.remove(); }catch{} }, 900);
  }
  if (titleEl) {
    titleEl.classList.add("shimmer");
    setTimeout(()=> titleEl.classList.remove("shimmer"), 900);
  }
}

/* =============== END OF PART 1/4 ===============
   - Next chunk will include: card builder, render helpers,
     initial load + pagination + realtime listener.
   - Reply: "Part 2/4 bhejo" to get the next part.
================================================= */

/* =============== PART 2/4 ===============
   - timeAgo helper (Instagram/TikTok style)
   - Card builder (flag → text → — username → relative time)
   - prepend/append helpers to avoid duplicates
   - initial load, loadMore, infinite scroll sentinel
   - realtime newest listener (top of feed)
========================================= */

/* ---------------- Relative Time helper ---------------- */
function timeAgo(ts){
  try {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 60) return `${sec} seconds ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minutes ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hours ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} days ago`;
    // fallback to short date for older
    return date.toLocaleDateString();
  } catch (e) {
    return "";
  }
}

/* ---------------- Card builder ---------------- */
function makeCard(docData = {}, docId){
  const data = docData || {};
  const country = (data.country || "").trim();
  const cc = (data.countryCode || "").toUpperCase() || normalizeCountry(country).countryCode;
  const flag = flagFromCode(cc);

  let rel = "";
  try {
    const ts = data.timestamp || data.created;
    rel = timeAgo(ts);
  } catch(e){
    rel = "";
  }

  const username = data.username ? String(data.username).trim() : "";

  const wrap = document.createElement("div");
  wrap.classList.add("blessing-card","fade-up");
  if (docId) wrap.dataset.id = docId;

  // make card markup (keeps structure compact, safe-escaped)
  wrap.innerHTML = `
    <b class="blessing-flag"><span class="flag">${escapeHTML(flag)}</span> ${escapeHTML(country || cc || "—")}</b>

    <div class="blessing-text">${(escapeHTML(data.text || "")).replace(/\n/g,"<br>")}</div>

    ${ username ? `<div class="blessing-user">— ${escapeHTML(username)}</div>` : "" }

    <div class="blessing-time">${escapeHTML(rel)}</div>
  `;
  return wrap;
}

/* ---------------- Render helpers (prevent duplicates) ---------------- */
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

/* ---------------- Pagination: loadInitial ---------------- */
async function loadInitial(){
  try {
    const q1 = query(collection(db,"blessings"), orderBy("timestamp","desc"), limit(PAGE_LIMIT));
    const snap = await getDocs(q1);

    blessingsList.innerHTML = "";
    renderedIds.clear();

    snap.docs.forEach(d => appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    initialLoaded = true;

    // animate main counter
    try { animateCount(counterEl, renderedIds.size); } catch(e){}

    if (!lastDoc) {
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
    } else {
      if (loadMoreBtn) loadMoreBtn.style.display = "block";
      if (noMoreEl) noMoreEl.textContent = "";
    }

    revealOnScroll();
    setupInfiniteObserver();
  } catch (err) {
    console.warn("Initial load failed", err);
    if (statusBox) statusBox.textContent = "Unable to load blessings right now.";
  }
}

/* ---------------- Pagination: loadMore ---------------- */
async function loadMore(){
  if (loadingMore) return;
  if (!lastDoc) {
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
    return;
  }
  loadingMore = true;
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  try {
    const qMore = query(
      collection(db,"blessings"),
      orderBy("timestamp","desc"),
      startAfter(lastDoc),
      limit(PAGE_LIMIT)
    );
    const snap = await getDocs(qMore);

    if (snap.empty){
      lastDoc = null;
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
      return;
    }

    snap.docs.forEach(d => appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    revealOnScroll();
  } catch (err) {
    console.warn("Load more failed", err);
    if (statusBox) statusBox.textContent = "Failed to load more.";
  } finally {
    loadingMore = false;
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  }
}

if (loadMoreBtn) loadMoreBtn.addEventListener("click", loadMore);

/* ---------------- Infinite scroll sentinel / observer ---------------- */
let infiniteObserver = null;
let sentinel = null;

function createSentinel(){
  if (document.getElementById("wbw_sentinel")) return document.getElementById("wbw_sentinel");
  sentinel = document.createElement("div");
  sentinel.id = "wbw_sentinel";
  sentinel.style.width = "1px";
  sentinel.style.height = "1px";
  sentinel.style.margin = "1px auto";
  blessingsList.insertAdjacentElement("afterend", sentinel);
  return sentinel;
}

function setupInfiniteObserver(){
  if (infiniteObserver) return;
  sentinel = createSentinel();
  if (!('IntersectionObserver' in window)) return;
  infiniteObserver = new IntersectionObserver(async (entries) => {
    for (const e of entries){
      if (e.isIntersecting && e.intersectionRatio > 0) {
        if (!initialLoaded) return;
        if (loadingMore || !lastDoc) return;
        await loadMore();
      }
    }
  }, {
    root: null,
    rootMargin: "400px", // preload earlier
    threshold: 0
  });
  if (sentinel) infiniteObserver.observe(sentinel);
}

/* ---------------- Realtime (newest top) ---------------- */
const liveNewest = query(
  collection(db,"blessings"),
  orderBy("timestamp","desc"),
  limit(1)
);

onSnapshot(liveNewest, (snap)=>{
  if (!initialLoaded) return;

  snap.docChanges().forEach(change => {
    if (change.type === "added"){
      const added = prependIfNew(change.doc);
      if (added) {
        try { animateCount(counterEl, renderedIds.size); } catch(e){}
        triggerSparkle(8);
      }
      revealOnScroll();
    }
  });
});

/* =============== END OF PART 2/4 ===============
   - Next chunk (Part 3/4) will include:
     My Blessings realtime subscription, username modal logic
     and submit flow (including username save + doc writes).
   - Reply: "Part 3/4 bhejo" to get it.
================================================= */

