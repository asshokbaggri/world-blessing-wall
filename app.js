/* ============================================================
   WORLD BLESSING WALL — APP.JS v1.2 (My-Blessings + username)
   - one-time username popup (stored in localStorage)
   - username saved into each blessing document (field: username)
   - username shown on public cards + My Blessings
   - my-count box updates & animates
   ============================================================ */

// ---------- Firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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
  where,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// my-blessings DOM
const myList = document.getElementById("myBlessingsList");
const myEmpty = document.getElementById("myEmpty");
const toggleMy = document.getElementById("toggleMy");
const refreshMy = document.getElementById("refreshMy");
const myCountEl = document.getElementById("myCount");

// ---- Username popup DOM ----
const usernamePopup = document.getElementById("usernamePopup");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsername");
const skipUsernameBtn = document.getElementById("skipUsername");

// micro-animation targets
let sparkleRoot = document.getElementById("sparkleBurst");
let liveToast   = document.getElementById("liveToast");
const titleEl   = document.querySelector(".title");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- STATE ----------
const renderedIds = new Set(); // public feed DOM ids
let lastDoc = null;
let initialLoaded = false;
let loadingMore = false; // guard pagination
const PAGE_LIMIT = 12;

// --------- CLIENT ID (persistent) & ipHash strategy ---------
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

// ipHash uses CLIENT_ID (stable) + UA + timezone
async function makeIpHash(){
  const seed = `${CLIENT_ID}::${navigator.userAgent}::${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(seed);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  // fallback
  let h = 0; for (let i=0;i<seed.length;i++){ h = (h*31 + seed.charCodeAt(i))|0; }
  return String(h >>> 0);
}

// ---------- Slug generator (unique personal link) ----------
function getOrCreateSlug(username) {
  const key = "wbw_user_slug_v1";
  let existing = localStorage.getItem(key);
  if (existing) return existing;

  // clean username
  let base = String(username || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // random 6-char id
  const rand = Math.random().toString(36).substring(2, 8);

  const slug = `${base}-${rand}`;
  localStorage.setItem(key, slug);
  return slug;
}

// ---------- Utils ----------

// CUSTOM GLASS ALERT (REPLACES BROWSER ALERT)
function showGlassAlert(msg = "") {
  const box = document.getElementById("glassAlert");
  const txt = document.getElementById("glassAlertText");
  if (!box || !txt) return;

  txt.textContent = msg;
  box.hidden = false;
  box.classList.add("show");

  const okBtn = document.getElementById("glassAlertOk");
  okBtn.onclick = () => {
    box.classList.remove("show");
    setTimeout(() => { box.hidden = true; }, 250);
  };
}

// COUNTER POP — requires .counter-anim in CSS
function animateCount(el, to){
  if (!el) return;
  el.classList.remove("counter-anim");
  void el.offsetWidth;
  el.classList.add("counter-anim");

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

// escape HTML to avoid accidental injection in innerHTML usage
function escapeHTML(s = ""){
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---- GLOBAL REALTIME UNSUB MAP ----
const docUnsubs = new Map();

// Non-blocking one-shot geo (returns {lat,lng} or null)
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

// ---------- Username MODAL (NEW — final selected) ----------

function openUsernamePopup() {
  usernamePopup.removeAttribute("hidden");
  usernamePopup.classList.add("show");
  setTimeout(() => usernameInput.focus(), 80);
}

function closeUsernamePopup() {
  usernamePopup.classList.remove("show");
  setTimeout(() => {
    usernamePopup.setAttribute("hidden", true);
  }, 180);
}

function getSavedUsername() {
  try {
    return (localStorage.getItem("wbw_username_v1") || "").trim();
  } catch {
    return "";
  }
}

function ensureUsernameModal() {
    const existing = getSavedUsername();
    if (existing) return Promise.resolve(existing);

    openUsernamePopup();

    return new Promise((resolve) => {

        // ---------- SAVE BUTTON ----------
        saveUsernameBtn.onclick = () => {
            const name = usernameInput.value.trim();

            if (!name) {
                showGlassAlert("Naam ek vibration hota hai… bas ek shabd likh do 🤍✨");
                return;
            }

            localStorage.setItem("wbw_username_v1", name);
            closeUsernamePopup();
            resolve(name);
        };

        // ---------- SKIP BUTTON ----------
        skipUsernameBtn.onclick = () => {
            showGlassAlert("Blessing post karne ke liye naam zaroori hai 🤍");
            closeUsernamePopup();
            resolve(null);
        };

    });
}


// ---------- Micro-animation helpers ----------
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

function timeAgo(ts) {
  if (!ts) return "";

  let date;
  try {
    date = ts.toDate ? ts.toDate() : new Date(ts);
  } catch {
    date = new Date(ts);
  }

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} sec ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ---------- Card builder ----------
function makeCard(docData = {}, docId){
  const data = docData || {};
  const country = (data.country || "").trim();
  const cc = (data.countryCode || "").toUpperCase() || normalizeCountry(country).countryCode;
  const flag = flagFromCode(cc);

  const ts = data.timestamp || data.created;
  const timeStr = timeAgo(ts);

  const username = data.username ? String(data.username).trim() : "";

  const wrap = document.createElement("div");
  wrap.classList.add("blessing-card", "fade-up");
  if (docId) wrap.dataset.id = docId;

  if (readObserver) readObserver.observe(wrap);

  // Card HTML: flag + country top, main text, then username line (— Name), then small time
  wrap.innerHTML = `
    <b><span class="flag">${escapeHTML(flag)}</span> ${escapeHTML(country || cc || "—")}</b>
    <div class="blessing-text">${(escapeHTML(data.text || "")).replace(/\n/g,"<br>")}</div>
    ${ username ? `<div class="blessing-username">— ${escapeHTML(username)}</div>` : "" }
    <div class="reads-float">👀 ${data.reads || 0}</div>
    <small class="blessing-time">${escapeHTML(timeStr)}</small>
  `;
  if (docId) wrap.setAttribute("data-id", docId);
  return wrap;
}

// ----------- READ COUNTER (Safe Increment per USERNAME) ----------- //
async function incrementRead(blessingId) {

    // HARD cooldown (fix +2 scroll bug permanently)
    if (!window.__readLock) window.__readLock = {};

    const now = Date.now();

    // If same card fires again within 700ms → block
    if (window.__readLock[blessingId] && (now - window.__readLock[blessingId]) < 700) {
        return;
    }

    window.__readLock[blessingId] = now;

    try {
        const deviceId = CLIENT_ID;
        const key = `seen_${deviceId}_${blessingId}`;

    // same device → do not increment again
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");

    // Firestore increment
    await updateDoc(doc(db, "blessings", blessingId), {
      reads: increment(1)
    });

    // ⭐ LOCAL UI POP + GLOW (without fake +1)
    const card = document.querySelector(`.blessing-card[data-id="${blessingId}"]`);
    if (card) {
        const readsEl = card.querySelector(".reads-float");
        if (readsEl) {

            // remove local +1 update ❌
            // just animation ✔

            // POP
            readsEl.classList.remove("reads-pop");
            void readsEl.offsetWidth;
            readsEl.classList.add("reads-pop");

            // GLOW
            readsEl.classList.add("reads-glow");
            setTimeout(() => readsEl.classList.remove("reads-glow"), 900);
        }
    }

  } catch (e) {
    console.log("read error", e);
  }
}

function subscribeToDoc(id) {
    // Already subscribed? skip
    if (docUnsubs.has(id)) return;

    const ref = doc(db, "blessings", id);

    const unsub = onSnapshot(ref, snap => {
        if (!snap.exists()) return;

        const data = snap.data();
        const card = document.querySelector(`.blessing-card[data-id="${id}"]`);
        if (!card) return;

        const readsEl = card.querySelector(".reads-float");
        if (!readsEl) return;

        // SAFARI — Guaranteed double reflow hack
        readsEl.textContent = `👀 ${data.reads || 0}`;

        // first repaint
        readsEl.style.transform = "scale(1.001)";
        readsEl.offsetHeight;

        // second repaint (Safari needs this)
        readsEl.style.transform = "scale(1)";
        readsEl.offsetHeight;

        // reset
        readsEl.style.transform = "";               
    });

    docUnsubs.set(id, unsub);
}

// ---------- Render helpers (prevent duplicates) ----------
function prependIfNew(docSnap){
    const id = docSnap.id;
    if (renderedIds.has(id)) return false;

    const el = makeCard(docSnap.data(), id);
    blessingsList.prepend(el);
    renderedIds.add(id);

    if (readObserver) readObserver.observe(el);

    // ⭐ NEW — subscribe for realtime read updates
    subscribeToDoc(id);

    return true;
}
function appendIfNew(docSnap){
    const id = docSnap.id;
    if (renderedIds.has(id)) return false;

    const el = makeCard(docSnap.data(), id);
    blessingsList.appendChild(el);
    renderedIds.add(id);

    if (readObserver) readObserver.observe(el);

    // ⭐ NEW — subscribe for realtime read updates
    subscribeToDoc(id);

    return true;
}

// ---------- Pagination (loadInitial + loadMore) ----------
async function loadInitial(){
  try {
    const q1 = query(collection(db,"blessings"), orderBy("timestamp","desc"), limit(PAGE_LIMIT));
    const snap = await getDocs(q1);

    blessingsList.innerHTML = "";
    renderedIds.clear();

    snap.docs.forEach(d => {
        appendIfNew(d);
        subscribeToDoc(d.id);   // ⭐ realtime fix
    });
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    initialLoaded = true;

    animateCount(counterEl, renderedIds.size);

    if (!lastDoc) {
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      if (noMoreEl) noMoreEl.textContent = "No more blessings 🤍";
    } else {
      if (loadMoreBtn) loadMoreBtn.style.display = "block";
      if (noMoreEl) noMoreEl.textContent = "";
    }

    revealOnScroll();
    setupInfiniteObserver(); // start observing after initial load
  } catch (err) {
    console.warn("Initial load failed", err);
    if (statusBox) statusBox.textContent = "Unable to load blessings right now.";
  }
}
loadInitial();

// ---------- loadMore ----------
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

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", loadMore);
}

// ---------- Infinite scroll (sentinel + IntersectionObserver) ----------
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
    rootMargin: "400px",
    threshold: 0
  });
  if (sentinel) infiniteObserver.observe(sentinel);
}

// --------- READ OBSERVER --------- //
let readObserver = null;

function isElementInViewport(el) {
  const r = el.getBoundingClientRect();
  return (
    r.top < window.innerHeight &&
    r.bottom > 0
  );
}

function setupReadObserver() {
  if (readObserver) return;

  readObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {

      if (!entry.isIntersecting) return;

      const id = entry.target.dataset.id;
      if (!id) return;

      // 🔥 FINAL SAFETY: block repeated triggers on same view
      if (entry.target.__readLock) return;

      entry.target.__readLock = true;
      incrementRead(id);

      // reset lock after card fully leaves viewport
      const reset = () => {
        if (!isElementInViewport(entry.target)) {
          entry.target.__readLock = false;
          window.removeEventListener('scroll', reset);
        }
      };

      window.addEventListener('scroll', reset);

    });
  }, {
    threshold: 0.25
  });

  // Observe all existing blessing cards
  document.querySelectorAll(".blessing-card").forEach(el => {
    readObserver.observe(el);
  });
}

setupReadObserver();

// ---------- Realtime (newest only for public feed) ----------
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
        animateCount(counterEl, renderedIds.size);
        triggerSparkle(8);
      }
      revealOnScroll();
    }
  });
});

// Load streak on page open
(function loadStreak(){
  const s = localStorage.getItem("wbw_streak_v1") || 0;
  const b = localStorage.getItem("wbw_streak_best_v1") || 0;

  const sEl = document.getElementById("streakCurrent");
  const bEl = document.getElementById("streakBest");

  if (sEl) sEl.textContent = s;
  if (bEl) bEl.textContent = b;
})();

// ---------- "My Blessings" (realtime) ----------
let myUnsub = null;
async function startMyBlss(){
  if (!myList) return;
  myList.innerHTML = "";
  if (myEmpty) myEmpty.textContent = "Loading…";
  try {
    const ipHash = await makeIpHash();
    const myQuery = query(
      collection(db,"blessings"),
      where("ipHash","==", ipHash),
      orderBy("timestamp","desc"),
      limit(50)
    );
    // detach previous
    if (typeof myUnsub === "function") myUnsub();
    myUnsub = onSnapshot(myQuery, (snap)=>{
      myList.innerHTML = "";
      if (snap.empty){
        if (myEmpty) myEmpty.textContent = "You haven't posted any blessings yet — write your first one!";
        if (myCountEl) animateCount(myCountEl, 0);
        return;
      }
      if (myEmpty) myEmpty.textContent = "";
      snap.docs.forEach(d=>{
        const el = makeCard(d.data(), d.id);
        myList.appendChild(el);
      });
      // update my-count
      try {
        const count = snap.docs.length;
        if (myCountEl) animateCount(myCountEl, count);
      } catch(e){}
    }, (err)=>{
      console.warn("MyBlessings snapshot failed", err);
      if (myEmpty) myEmpty.textContent = "Unable to load your blessings right now.";
    });
  } catch (err) {
    console.warn("startMyBlss failed", err);
    if (myEmpty) myEmpty.textContent = "Unable to load your blessings right now.";
  }
}

// toggle / refresh actions
if (toggleMy) {
  toggleMy.addEventListener("click", ()=>{
    const sec = document.getElementById("myBlessings");
    if (!sec) return;
    if (sec.style.display === "none") {
      sec.style.display = "";
      toggleMy.textContent = "Hide My Blessings";
    } else {
      sec.style.display = "none";
      toggleMy.textContent = "Show My Blessings";
    }
  });
}
if (refreshMy) refreshMy.addEventListener("click", ()=> startMyBlss());

// start my blessings once app loads (non-blocking)
startMyBlss();

// ---------- Submit flow ----------
if (sendBtn) {
  sendBtn.addEventListener("click", submitBlessing);
}
if (blessingInput) {
  blessingInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
  });
}

async function submitBlessing(){
  const rawText = (blessingInput?.value || "").trim();
  const rawCountry = (countryInput?.value || "").trim();

  if (!rawText) { if (blessingInput) blessingInput.focus(); return; }
  if (!rawCountry) { if (countryInput) countryInput.focus(); return; }

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.opacity = ".7";
  }

  try {
    // ensure username (one-time popup)
    const username = await ensureUsernameModal();
    if (!username) {
      // user cancelled name entry
      if (statusBox) {
        statusBox.textContent = "Posting cancelled — name required to post.";
        statusBox.style.color = "#ffb4b4";
      }
      return;
    }

    // create/get personal slug
    const slug = getOrCreateSlug(username);

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
      source: (document.referrer ? new URL(document.referrer).hostname : "direct"),
      language: lang,
      sentimentScore: 0,
      ipHash,
      username: username,
      userSlug: slug,     // ⭐ personal slug
      slugCreated: true,      // ⭐ flag
      blessingId: ""
    };

    const ref = await addDoc(collection(db,"blessings"), base);
    await updateDoc(doc(db,"blessings", ref.id), { blessingId: ref.id }).catch(()=>{});

    getGeoOnce().then(geo=>{
      if (geo) {
        updateDoc(doc(db,"blessings", ref.id), {
          "geo.city": geo.city,
          "geo.region": geo.region,
          "geo.lat": geo.lat,
          "geo.lng": geo.lng
        }).catch(()=>{});
      }
    });

    // ---------- STREAK SYSTEM ----------
    const streakKey = "wbw_streak_v1";
    const streakLastKey = "wbw_streak_last_v1";
    const streakBestKey = "wbw_streak_best_v1";

    // local streak values
    let streak = Number(localStorage.getItem(streakKey) || 0);
    let lastDate = localStorage.getItem(streakLastKey) || "";
    let best = Number(localStorage.getItem(streakBestKey) || 0);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (!lastDate) {
        streak = 1; // first ever
    } else {
        const last = new Date(lastDate);
        const diff = (today - last) / (1000 * 60 * 60 * 24);

        if (diff < 1) {
            streak = streak || 1; // already blessed today
        } else if (diff < 2) {
            streak += 1; // yesterday blessed
        } else {
            streak = 1; // missed days → reset
        }
    }

    // update best streak
    if (streak > best) best = streak;

    // save streak
    localStorage.setItem(streakKey, streak);
    localStorage.setItem(streakLastKey, todayStr);
    localStorage.setItem(streakBestKey, best);

    // ⬅️ Ye tab chalega jab streak update ho
    const cur = document.getElementById("streakCurrent");
    const bestEl = document.getElementById("streakBest");

    if (cur) cur.textContent = streak;
    if (bestEl) bestEl.textContent = best;

    // POP ANIMATION
    if (cur) {
        cur.classList.add("streak-pop");
        setTimeout(() => cur.classList.remove("streak-pop"), 600);
    }

    if (statusBox) {
      statusBox.textContent = "Blessing submitted ✅";
      statusBox.style.color = "#bfe4c2";
    }

    // ---- AUTO SHARE AFTER BLESSING ---- //
    try {
        const box = document.getElementById("autoShareMsg");
        const msg = box ? box.textContent.trim() : "";

        // WhatsApp auto-open (iOS + Android safe)
        const wa = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
        window.location.href = wa;   // iOS safe redirect

    } catch (e) {
        console.log("Auto share failed", e);
    }

    // micro animations
    pulseSendBtn();
    triggerSparkle(14);
    showLiveToast("✨ Your blessing is live!");

    // clear input but keep country
    if (blessingInput) blessingInput.value = "";
    await sleep(1100);
    if (statusBox) {
      statusBox.textContent = "";
      statusBox.style.color = "";
    }

    // refresh "My Blessings" after submit (so new item shows without reload)
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

// ---------- Share buttons (with personal /me/slug) ----------

// 1) Get personal slug
const mySlug = localStorage.getItem("wbw_user_slug_v1") || "";

// 2) Build personal link
const myPersonalLink = `${location.origin}/me/${mySlug}`;

// 3) Final spiritual share message (Asshok vibe)  
const shareText = encodeURIComponent(
  `Maine aaj ek choti si blessing likhi… 💫\n` +
  `Dil halka ho jata hai jab kuch achha likhte ho.\n` +
  `Tum bhi ek dua likho — duniya ko thoda sa aur roshan karte hain 🤍✨\n👇\n${myPersonalLink}`
);

// 4) WhatsApp
waShare?.addEventListener("click", () => {
  window.open(`https://wa.me/?text=${shareText}`, "_blank");
});

// 5) Twitter
twShare?.addEventListener("click", () => {
  window.open(
    `https://twitter.com/intent/tweet?text=${shareText}`,
    "_blank"
  );
});

// 6) Copy Link
copyShare?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      `Maine aaj ek choti si blessing likhi… 💫
Dil halka ho jata hai jab kuch achha likhte ho.
Tum bhi ek dua likho — duniya ko thoda sa aur roshan karte hain 🤍✨
👇
${myPersonalLink}`
    );
    const prev = copyShare.textContent;
    copyShare.textContent = "Link Copied ✅";
    await sleep(1200);
    copyShare.textContent = prev || "Copy Link";
  } catch {}
});

// ------- Daily Challenge Mode ------- //
(function loadDailyChallenge(){
  
  const challenges = [
    "Aaj kisi unknown ke liye dua likho 💛",
    "Apne future self ke liye blessing likho ✨",
    "Kisi stranger ko happiness send karo 😊",
    "Duniya ke liye ek choti si dua likho 🌍",
    "Aaj gratitude blessing likho 🤍",
  ];

  const box = document.getElementById("challengeText");
  if (!box) return;

  // date key
  const today = new Date().toISOString().slice(0,10);

  // check saved challenge
  let saved = localStorage.getItem("wbw_challenge_day");
  let text  = localStorage.getItem("wbw_challenge_text");

  if (saved !== today || !text) {
    // new challenge
    text = challenges[Math.floor(Math.random() * challenges.length)];
    localStorage.setItem("wbw_challenge_day", today);
    localStorage.setItem("wbw_challenge_text", text);
  }

  box.textContent = text;

})();

// ---------- Particles (full-screen, always behind) ----------
(function initParticles(){
  const canvas = document.getElementById("goldParticles");
  if (!canvas) return;
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

  const COUNT = Math.floor((W * H) / 28000) + 90;
  const stars = Array.from({ length: COUNT }).map(() => ({
    x: Math.random()*W,
    y: Math.random()*H,
    r: Math.random()*1.4 + 0.4,
    vx: Math.random()*0.2 - 0.1,
    vy: Math.random()*0.25 + 0.1,
    tw: Math.random()*Math.PI*2,
    ts: 0.005 + Math.random()*0.008
  }));

  function animate(){
    ctx.clearRect(0,0,W,H);
    for (const s of stars){
      s.x += s.vx;
      s.y += s.vy;
      s.tw += s.ts;
      if (s.y > H + 8){
        s.y = -8;
        s.x = Math.random()*W;
      }
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

// ---------- Scroll fade reveal ----------
function revealOnScroll(){
  const els = document.querySelectorAll(".fade-up, .fade-section");
  const trigger = window.innerHeight * 0.92;
  els.forEach(el => {
    if (el.getBoundingClientRect().top < trigger) el.classList.add("show");
  });
}
window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);

// ---------- Start "My Blessings" UI quick hint (runs after client ready) ----------
console.info("World Blessing Wall — app.js v1.2 loaded (My-Blessings + username)");

// ---------- Phase 6 Map JS ----------
// call initWorldMap() after DOMContentLoaded or on page ready
function initWorldMap() {
  const svgContainer = document.getElementById('svgContainer');
  const dotLayer = document.getElementById('dotLayer');
  const globalCountNum = document.getElementById('globalCountNum');
  const drawer = document.getElementById('countryDrawer');
  const drawerTitle = document.getElementById('drawerTitle');
  const drawerList = document.getElementById('drawerList');
  const shareBtn = document.getElementById('shareMapBtn');

  // sample data (replace with your API results)
  const countries = {
    IN: { name: 'India', lat: 22.0, lon: 78.0, count: 342, blessings: [
      { text:'Jai shree ram — — Asshok', time:'yesterday' },
      { text:'Ram ji Ram sa — Mehul', time:'2 days ago' }
    ]},
    BR: { name: 'Brazil', lat: -14.2, lon: -51.9, count: 68, blessings: [ {text:'Brazil blessing', time:'today'} ]},
    US: { name: 'United States', lat: 37.1, lon: -95.7, count: 184, blessings: [ {text:'US blessing', time:'today'} ]},
    // add more...
  };

  // GLOBAL COUNT from data
  let globalCount = Object.values(countries).reduce((s,c)=>s+(c.count||0),0);
  globalCountNum.textContent = globalCount;

  // load world svg file and insert
  fetch('/world.svg') // ensure file exists
    .then(r => r.text())
    .then(svgText => {
      svgContainer.innerHTML = svgText;
      // make svg responsive
      const svg = svgContainer.querySelector('svg');
      if(svg){
        svg.setAttribute('preserveAspectRatio','xMidYMid meet');
        svg.style.width = '100%';
        svg.style.height = '100%';
      }
      // After svg loaded, place dots
      placeAllDots();
    })
    .catch(err => {
      // fallback: show placeholder rectangle
      svgContainer.innerHTML = '<div style="color:var(--text-dim)">Map failed to load — put world.svg in site root.</div>';
      console.error('SVG load failed', err);
    });

  // equirectangular projection: convert lat/lon to x,y inside svg container dimensions
  function lonLatToXY(lon, lat, w, h){
    // lon in [-180,180], lat in [-90,90]
    // equirectangular: x = (lon+180)/360 * w ; y = (90-lat)/180 * h
    const x = ((lon + 180) / 360) * w;
    const y = ((90 - lat) / 180) * h;
    return { x, y };
  }

  // place dots by iterating countries
  function placeAllDots(){
    const rect = svgContainer.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    dotLayer.innerHTML = '';
    for(const code in countries){
      const c = countries[code];
      if(!c.lat || !c.lon) continue;
      const pos = lonLatToXY(c.lon, c.lat, w, h);
      const el = document.createElement('div');
      el.className = 'country-dot';
      // size class
      if(c.count > 200) el.classList.add('size-l');
      else if(c.count > 60) el.classList.add('size-m');
      else el.classList.add('size-s');
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.setAttribute('data-code', code);
      el.setAttribute('title', `${c.name} — ${c.count} blessings`);
      el.style.pointerEvents = 'auto';
      dotLayer.appendChild(el);

      el.addEventListener('click', (e) => {
        openDrawerFor(code);
        e.stopPropagation();
      });

      // slight randomized pulse phase
      if(Math.random()>0.35) el.classList.add('pulse');
    }
  }

  // handle window resize -> reposition dots
  window.addEventListener('resize', debounce(()=> placeAllDots(), 180));

  // open drawer
  function openDrawerFor(code){
    const c = countries[code];
    if(!c) return;
    drawerTitle.textContent = `${c.name} — ${c.count} blessings`;
    drawerList.innerHTML = '';
    (c.blessings || []).forEach(b => {
      const card = document.createElement('div');
      card.className = 'blessing-card';
      card.innerHTML = `<b>${b.text}</b><div class="reads">${b.time}</div>`;
      drawerList.appendChild(card);
    });
    drawer.classList.add('open');
  }

  // close drawer
  document.getElementById('drawerClose').addEventListener('click', () => drawer.classList.remove('open'));

  // update function to call when a new blessing is added in a country
  function updateCountryCount(code, delta=1, newBlessing=null){
    const c = countries[code];
    if(!c) return;
    c.count += delta;
    if(newBlessing) c.blessings = c.blessings || [], c.blessings.unshift(newBlessing);

    // update global
    globalCount += delta;
    animateCount(globalCountNum, globalCount);

    // find dot element and pop
    const dot = dotLayer.querySelector(`[data-code="${code}"]`);
    if(dot){
      dot.classList.add('pop');
      setTimeout(()=> dot.classList.remove('pop'), 550);
      // adjust size class if thresholds crossed
      dot.classList.remove('size-s','size-m','size-l');
      if(c.count > 200) dot.classList.add('size-l');
      else if(c.count > 60) dot.classList.add('size-m');
      else dot.classList.add('size-s');
      dot.setAttribute('title', `${c.name} — ${c.count} blessings`);
    }
  }

  // simple count animation (fast)
  function animateCount(el, value){
    // quick number change anim
    el.textContent = value;
    el.classList.add('counter-anim');
    setTimeout(()=> el.classList.remove('counter-anim'), 420);
  }

  // share map — minimal clean shot using html2canvas
  shareBtn.addEventListener('click', async () => {
    const wrap = document.querySelector('.map-wrap');
    wrap.classList.add('share-mode'); // hide UI
    // small delay so styles settle
    await sleep(220);
    html2canvas(wrap, { backgroundColor: null, useCORS: true, scale: 2 }).then(canvas => {
      // produce image
      const data = canvas.toDataURL('image/png');
      // download
      const a = document.createElement('a');
      a.href = data;
      a.download = 'blessings-map.png';
      a.click();
      wrap.classList.remove('share-mode');
    }).catch(err=>{
      console.error('html2canvas error',err);
      wrap.classList.remove('share-mode');
    });
  });

  // small helpers
  function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }
  function debounce(fn, t){ let id; return ()=> { clearTimeout(id); id = setTimeout(fn, t); }; }

  // expose update function globally for live updates
  window.updateCountryCount = updateCountryCount;
  window.worldMapData = countries;
}

// init
document.addEventListener('DOMContentLoaded', () => {
  if(document.getElementById('mapWrap')) initWorldMap();
});
