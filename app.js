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

/* =============== PART 3/4 ===============
   - Username modal logic (modern HTML modal)
   - My Blessings realtime subscription + my-count update
   - Submit flow (username enforced, addDoc, updateDoc, geo backfill)
   - Safe handlers (attach once)
========================================= */

/* ---------------- Username Modal (HTML modal) ---------------- */
// Assumes these DOM nodes exist (declared in Part 1/4 earlier):
// usernamePopup, usernameInput, saveUsernameBtn, skipUsernameBtn

function openUsernamePopup() {
  try {
    if (!usernamePopup) return;
    usernamePopup.removeAttribute("hidden");
    // small CSS hook to animate if you added .show in CSS
    usernamePopup.classList.add("show");
    // focus with tiny delay to allow modal to become visible
    setTimeout(() => {
      try { usernameInput.focus(); } catch(e){}
    }, 60);
  } catch (e) { console.warn("openUsernamePopup failed", e); }
}

function closeUsernamePopup() {
  try {
    if (!usernamePopup) return;
    usernamePopup.classList.remove("show");
    setTimeout(() => {
      try { usernamePopup.setAttribute("hidden", true); } catch(e){}
    }, 180);
  } catch (e) { console.warn("closeUsernamePopup failed", e); }
}

function getSavedUsername() {
  try {
    return (localStorage.getItem("wbw_username_v1") || "").trim();
  } catch (e) {
    return "";
  }
}

/**
 * ensureUsernameModal()
 * - if user already saved a name, returns it
 * - otherwise opens modal and returns the chosen name or null (if skipped)
 * - this returns a Promise that resolves when user chooses
 */
function ensureUsernameModal() {
  const current = getSavedUsername();
  if (current) return Promise.resolve(current);

  // open modal and wait for user action
  openUsernamePopup();

  return new Promise((resolve) => {
    // remove previous handlers if any
    saveUsernameBtn.onclick = null;
    skipUsernameBtn.onclick = null;

    saveUsernameBtn.addEventListener("click", function saveHandler() {
      const v = (usernameInput.value || "").trim();
      if (!v) {
        alert("Naam khaali nahi ho sakta ❤️");
        usernameInput.focus();
        return;
      }
      try { localStorage.setItem("wbw_username_v1", v); } catch(e){}
      closeUsernamePopup();
      // cleanup
      saveUsernameBtn.removeEventListener("click", saveHandler);
      resolve(v);
    });

    skipUsernameBtn.addEventListener("click", function skipHandler() {
      // we make skip warn user that name is required; keep behavior consistent:
      alert("Blessing post karne ke liye naam zaroori hai 🙏");
      // cleanup and resolve null (submit flow will respect this)
      skipUsernameBtn.removeEventListener("click", skipHandler);
      resolve(null);
    });
  });
}

/* ---------------- My Blessings realtime subscription ---------------- */
let myUnsub = null;

async function startMyBlss() {
  try {
    if (!myList) return;
    myList.innerHTML = "";
    if (myEmpty) myEmpty.textContent = "Loading…";

    const ipHash = await makeIpHash();
    const myQuery = query(
      collection(db, "blessings"),
      where("ipHash", "==", ipHash),
      orderBy("timestamp", "desc"),
      limit(60)
    );

    // detach previous listener
    if (typeof myUnsub === "function") {
      try { myUnsub(); } catch(e){}
    }

    myUnsub = onSnapshot(myQuery, (snap) => {
      myList.innerHTML = "";

      if (snap.empty) {
        if (myEmpty) myEmpty.textContent = "You haven’t posted any blessings yet 🌟";
        if (myCountEl) animateCount(myCountEl, 0);
        return;
      }

      if (myEmpty) myEmpty.textContent = "";

      snap.docs.forEach((d) => {
        const el = makeCard(d.data(), d.id);
        myList.appendChild(el);
      });

      // update my-count (animate)
      try {
        const count = snap.docs.length;
        if (myCountEl) animateCount(myCountEl, count);
      } catch (e) { /* ignore */ }
    }, (err) => {
      console.warn("MyBlessings snapshot failed", err);
      if (myEmpty) myEmpty.textContent = "Unable to load your blessings.";
    });
  } catch (err) {
    console.warn("startMyBlss failed", err);
    if (myEmpty) myEmpty.textContent = "Unable to load your blessings.";
  }
}

/* ---------------- Submit flow (uses username modal) ---------------- */
async function submitBlessing(){
  try {
    if (!blessingInput || !countryInput) return;
    const rawText = (blessingInput.value || "").trim();
    const rawCountry = (countryInput.value || "").trim();

    if (!rawText) { blessingInput.focus(); return; }
    if (!rawCountry) { countryInput.focus(); return; }

    // UI guard
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.style.opacity = ".6";
    }
    if (statusBox) {
      statusBox.textContent = "";
      statusBox.style.color = "";
    }

    // get username (modal)
    const username = await ensureUsernameModal();
    if (!username) {
      // user skipped / cancelled — show friendly message
      if (statusBox) {
        statusBox.textContent = "Posting cancelled — name required to post.";
        statusBox.style.color = "#ffb4b4";
      }
      return;
    }

    const lang = detectLang(rawText);
    const { country, countryCode } = normalizeCountry(rawCountry || "");
    const ipHash = await makeIpHash();

    const base = {
      text: rawText,
      country,
      countryCode,
      timestamp: serverTimestamp(),
      created: serverTimestamp(),
      language: lang,
      ipHash,
      username,
      sentimentScore: 0,
      status: "approved",
      device: "web",
      source: (document.referrer ? new URL(document.referrer).hostname : "direct"),
      blessingId: ""
    };

    // write doc
    const ref = await addDoc(collection(db, "blessings"), base);
    // backfill blessingId
    try { await updateDoc(doc(db,"blessings", ref.id), { blessingId: ref.id }); } catch(e){}

    // optional geo backfill (non-blocking)
    getGeoOnce().then((geo) => {
      if (geo) {
        try {
          updateDoc(doc(db,"blessings", ref.id), {
            "geo.lat": geo.lat,
            "geo.lng": geo.lng,
            "geo.city": geo.city,
            "geo.region": geo.region
          }).catch(()=>{});
        } catch(e){}
      }
    });

    // friendly UI feedback
    if (statusBox) {
      statusBox.textContent = "Blessing submitted ✅";
      statusBox.style.color = "#bfe4c2";
    }

    // micro-animations & toast
    pulseSendBtn();
    triggerSparkle(14);
    showLiveToast("✨ Your blessing is live!");

    // clear input but keep country for fast multi-posting
    blessingInput.value = "";

    // short delay to let realtime add prepend
    await sleep(900);

    // clear status
    if (statusBox) {
      statusBox.textContent = "";
      statusBox.style.color = "";
    }

    // refresh my list (so new item appears immediately)
    startMyBlss();
  } catch (err) {
    console.warn("Submit failed", err);
    if (statusBox) {
      statusBox.textContent = "Something went wrong — try again 🙏";
      statusBox.style.color = "#ffb4b4";
    }
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    }
  }
}

// make sure submit handlers attached (idempotent)
if (sendBtn) {
  sendBtn.removeEventListener("click", submitBlessing);
  sendBtn.addEventListener("click", submitBlessing);
}
if (blessingInput) {
  blessingInput.removeEventListener("keydown", submitBlessing);
  blessingInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
  });
}

/* =============== END OF PART 3/4 ===============
   - Next (Part 4/4) will include:
     Share handlers, particles (already present), revealOnScroll hooks,
     final console.info and any CSS hooks for modal.
   - Reply: "Part 4/4 bhejo" to get final chunk.
================================================= */

/* =============== PART 4/4 ===============
   - finish timeAgo helper
   - safety for infinite observer (no duplicate)
   - particles (if not already present)
   - revealOnScroll hook + initial calls
   - final console.info
   - no modal auto-open on page load
========================================= */

/* -------------------- timeAgo (finish) -------------------- */
function timeAgo(ts) {
  if (!ts) return "";
  let date;
  try {
    date = ts.toDate ? ts.toDate() : new Date(ts);
  } catch (e) {
    date = new Date(ts);
  }
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 0) return "just now";
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} days ago`;
  // older than a week — show date (short)
  try {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return date.toLocaleString();
  }
}

/* -------------------- Safe infinite observer (idempotent) -------------------- */
if (!window.__wbw_infinite_setup) {
  window.__wbw_infinite_setup = true;
  // sentinel & observer were defined in earlier parts; ensure creation if missing
  (function ensureSentinelAndObserver(){
    try {
      if (!document.getElementById("wbw_sentinel")) {
        const s = document.createElement("div");
        s.id = "wbw_sentinel";
        s.style.width = "1px";
        s.style.height = "1px";
        s.style.margin = "1px auto";
        blessingsList && blessingsList.insertAdjacentElement("afterend", s);
      }
    } catch(e){}
  })();
}

/* -------------------- Particles (already present in earlier parts, but safe-guard) -------------------- */
if (!window.__wbw_particles_inited) {
  window.__wbw_particles_inited = true;
  (function initParticlesSafe() {
    const canvas = document.getElementById("goldParticles");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let W = window.innerWidth;
    let H = window.innerHeight;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const COUNT = Math.floor((W * H) / 28000) + 90;
    const stars = Array.from({ length: COUNT }).map(() => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4,
      vx: Math.random() * 0.2 - 0.1,
      vy: Math.random() * 0.25 + 0.1,
      tw: Math.random() * Math.PI * 2,
      ts: 0.005 + Math.random() * 0.008,
    }));

    function animate() {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        s.tw += s.ts;
        if (s.y > H + 8) {
          s.y = -8;
          s.x = Math.random() * W;
        }
        const glow = 0.55 + 0.4 * Math.sin(s.tw);
        ctx.globalAlpha = glow;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 7);
        g.addColorStop(0, "rgba(255,240,190,1)");
        g.addColorStop(1, "rgba(255,240,190,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  })();
}

/* -------------------- Reveal on scroll (call once) -------------------- */
(function initReveal() {
  try {
    window.addEventListener("scroll", revealOnScroll);
    window.addEventListener("load", revealOnScroll);
    // initial reveal in case some elements are already visible
    setTimeout(revealOnScroll, 120);
  } catch (e) { console.warn("initReveal failed", e); }
})();

/* -------------------- Final safety: attach share handlers if missing -------------------- */
try {
  if (waShare && waShare.onclick === null) {
    waShare.onclick = () => {
      window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`, "_blank");
    };
  }
  if (twShare && twShare.onclick === null) {
    twShare.onclick = () => {
      window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`, "_blank");
    };
  }
  if (copyShare && copyShare.onclick === null) {
    copyShare.onclick = async () => {
      try {
        await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
        const prev = copyShare.textContent;
        copyShare.textContent = "Link Copied ✅";
        await sleep(1000);
        copyShare.textContent = prev || "Copy Link";
      } catch {}
    };
  }
} catch (e){}

/* -------------------- Final console message -------------------- */
console.info("World Blessing Wall — app.js v1.3 final part loaded (modal + viral mode).");

/* =================== NOTES (READ BEFORE PASTING) ===================
  1) You pasted Part1/2/3 earlier. Ensure no duplicate function names across parts.
  2) The username modal will NOT open on page load. It only opens when user clicks Send
     and no username is saved. (ensureUsernameModal -> openUsernamePopup)
  3) If popup showed on load previously, check that index.html DOES NOT call ensureUsernameModal()
     on load and that usernamePopup HTML is present and has hidden attribute by default.
  4) If Save/Skip didn't work earlier, confirm index.html contains elements with IDs:
       - usernamePopup (a container with attribute hidden)
       - usernameInput (input text)
       - saveUsername  (button)
       - skipUsername  (button)
  5) If infinite scroll disappeared, ensure you pasted earlier sentinel creation (Part 2/3).
  6) If you want the modal to look different, update CSS (you already added modal CSS in style.css).
================================================================== */
