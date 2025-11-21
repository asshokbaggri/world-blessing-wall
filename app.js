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

/* ============================================================
   D3 WORLD MAP — INIT (paste this replacement into app.js)
   - Requires: d3 imported (you already import earlier)
   - Expects: world.geojson at same folder (WORLD_JSON_URL)
   - Uses: loadBlessingsForMap() and groupByCountryFixed() from your app (if present)
   ============================================================ */

const WORLD_JSON_URL = "world.geojson"; // change if path different

function getPixelSizeForWrap(wrap) {
  const r = wrap.getBoundingClientRect();
  // keep min size to avoid degenerate map
  const w = Math.max(320, Math.round(r.width));
  const h = Math.round(w * 0.52); // ~2:1 ratio
  return { w, h };
}

// ===========================
// WORLD CENTROID DATABASE (240 countries)
// ISO2 → { lat, lng }
// ===========================
const COUNTRY_CENTROIDS = {
  "AF": { lat: 33.93911, lng: 67.709953 },
  "AL": { lat: 41.1533, lng: 20.1683 },
  "DZ": { lat: 28.0339, lng: 1.6596 },
  "AD": { lat: 42.5063, lng: 1.5218 },
  "AO": { lat: -11.2027, lng: 17.8739 },
  "AR": { lat: -38.4161, lng: -63.6167 },
  "AM": { lat: 40.0691, lng: 45.0382 },
  "AU": { lat: -25.2744, lng: 133.7751 },
  "AT": { lat: 47.5162, lng: 14.5501 },
  "AZ": { lat: 40.1431, lng: 47.5769 },
  "BH": { lat: 26.0667, lng: 50.5577 },
  "BD": { lat: 23.685, lng: 90.3563 },
  "BY": { lat: 53.7098, lng: 27.9534 },
  "BE": { lat: 50.5039, lng: 4.4699 },
  "BZ": { lat: 17.1899, lng: -88.4976 },
  "BJ": { lat: 9.3077, lng: 2.3158 },
  "BT": { lat: 27.5142, lng: 90.4336 },
  "BO": { lat: -16.2902, lng: -63.5887 },
  "BA": { lat: 43.9159, lng: 17.6791 },
  "BW": { lat: -22.3285, lng: 24.6849 },
  "BR": { lat: -14.235, lng: -51.9253 },
  "BN": { lat: 4.5353, lng: 114.7277 },
  "BG": { lat: 42.7339, lng: 25.4858 },
  "BF": { lat: 12.2383, lng: -1.5616 },
  "BI": { lat: -3.3731, lng: 29.9189 },
  "KH": { lat: 12.5657, lng: 104.991 },
  "CM": { lat: 7.3697, lng: 12.3547 },
  "CA": { lat: 56.1304, lng: -106.3468 },
  "CF": { lat: 6.6111, lng: 20.9394 },
  "TD": { lat: 15.4542, lng: 18.7322 },
  "CL": { lat: -35.6751, lng: -71.543 },
  "CN": { lat: 35.8617, lng: 104.1954 },
  "CO": { lat: 4.5709, lng: -74.2973 },
  "KM": { lat: -11.6455, lng: 43.3333 },
  "CG": { lat: -0.228, lng: 15.8277 },
  "CD": { lat: -4.0383, lng: 21.7587 },
  "CR": { lat: 9.7489, lng: -83.7534 },
  "CI": { lat: 7.54, lng: -5.5471 },
  "HR": { lat: 45.1, lng: 15.2 },
  "CU": { lat: 21.5218, lng: -77.7812 },
  "CY": { lat: 35.1264, lng: 33.4299 },
  "CZ": { lat: 49.8175, lng: 15.473 },
  "DK": { lat: 56.2639, lng: 9.5018 },
  "DJ": { lat: 11.8251, lng: 42.5903 },
  "DM": { lat: 15.415, lng: -61.371 },
  "DO": { lat: 18.7357, lng: -70.1627 },
  "EC": { lat: -1.8312, lng: -78.1834 },
  "EG": { lat: 26.8206, lng: 30.8025 },
  "SV": { lat: 13.7942, lng: -88.8965 },
  "GQ": { lat: 1.6508, lng: 10.2679 },
  "ER": { lat: 15.1794, lng: 39.7823 },
  "EE": { lat: 58.5953, lng: 25.0136 },
  "ET": { lat: 9.145, lng: 40.4897 },
  "FI": { lat: 61.9241, lng: 25.7482 },
  "FR": { lat: 46.6034, lng: 1.8883 },
  "GA": { lat: -0.8037, lng: 11.6094 },
  "GM": { lat: 13.4432, lng: -15.3101 },
  "GE": { lat: 42.3154, lng: 43.3569 },
  "DE": { lat: 51.1657, lng: 10.4515 },
  "GH": { lat: 7.9465, lng: -1.0232 },
  "GR": { lat: 39.0742, lng: 21.8243 },
  "GT": { lat: 15.7835, lng: -90.2308 },
  "GN": { lat: 9.9456, lng: -9.6966 },
  "GW": { lat: 11.8037, lng: -15.1804 },
  "GY": { lat: 4.8604, lng: -58.9302 },
  "HT": { lat: 18.9712, lng: -72.2852 },
  "HN": { lat: 15.1999, lng: -86.2419 },
  "HU": { lat: 47.1625, lng: 19.5033 },
  "IS": { lat: 64.9631, lng: -19.0208 },
  "IN": { lat: 20.5937, lng: 78.9629 },
  "ID": { lat: -0.7893, lng: 113.9213 },
  "IR": { lat: 32.4279, lng: 53.688 },
  "IQ": { lat: 33.2232, lng: 43.6793 },
  "IE": { lat: 53.4129, lng: -8.2439 },
  "IL": { lat: 31.0461, lng: 34.8516 },
  "IT": { lat: 41.8719, lng: 12.5674 },
  "JM": { lat: 18.1096, lng: -77.2975 },
  "JP": { lat: 36.2048, lng: 138.2529 },
  "JO": { lat: 30.5852, lng: 36.2384 },
  "KZ": { lat: 48.0196, lng: 66.9237 },
  "KE": { lat: -0.0236, lng: 37.9062 },
  "KR": { lat: 35.9078, lng: 127.7669 },
  "KW": { lat: 29.3117, lng: 47.4818 },
  "KG": { lat: 41.2044, lng: 74.7661 },
  "LA": { lat: 19.8563, lng: 102.4955 },
  "LV": { lat: 56.8796, lng: 24.6032 },
  "LB": { lat: 33.8547, lng: 35.8623 },
  "LS": { lat: -29.6099, lng: 28.2336 },
  "LR": { lat: 6.4281, lng: -9.4295 },
  "LY": { lat: 26.3351, lng: 17.2283 },
  "LT": { lat: 55.1694, lng: 23.8813 },
  "LU": { lat: 49.8153, lng: 6.1296 },
  "MG": { lat: -18.7669, lng: 46.8691 },
  "MW": { lat: -13.2543, lng: 34.3015 },
  "MY": { lat: 4.2105, lng: 101.9758 },
  "MV": { lat: 3.2028, lng: 73.2207 },
  "ML": { lat: 17.5707, lng: -3.9962 },
  "MT": { lat: 35.9375, lng: 14.3754 },
  "MR": { lat: 21.0079, lng: -10.9408 },
  "MU": { lat: -20.3484, lng: 57.5522 },
  "MX": { lat: 23.6345, lng: -102.5528 },
  "MD": { lat: 47.4116, lng: 28.3699 },
  "MN": { lat: 46.8625, lng: 103.8467 },
  "ME": { lat: 42.7087, lng: 19.3744 },
  "MA": { lat: 31.7917, lng: -7.0926 },
  "MZ": { lat: -18.6657, lng: 35.5296 },
  "MM": { lat: 21.9162, lng: 95.956 },
  "NA": { lat: -22.9576, lng: 18.4904 },
  "NP": { lat: 28.3949, lng: 84.124 },
  "NL": { lat: 52.1326, lng: 5.2913 },
  "NZ": { lat: -40.9006, lng: 174.886 },
  "NI": { lat: 12.8654, lng: -85.2072 },
  "NE": { lat: 17.6078, lng: 8.0817 },
  "NG": { lat: 9.082, lng: 8.6753 },
  "NO": { lat: 60.472, lng: 8.4689 },
  "OM": { lat: 21.4735, lng: 55.9754 },
  "PK": { lat: 30.3753, lng: 69.3451 },
  "PA": { lat: 8.5379, lng: -80.7821 },
  "PG": { lat: -6.31499, lng: 143.9555 },
  "PY": { lat: -23.4425, lng: -58.4438 },
  "PE": { lat: -9.19, lng: -75.0152 },
  "PH": { lat: 12.8797, lng: 121.774 },
  "PL": { lat: 51.9194, lng: 19.1451 },
  "PT": { lat: 39.3999, lng: -8.2245 },
  "QA": { lat: 25.3548, lng: 51.1839 },
  "RO": { lat: 45.9432, lng: 24.9668 },
  "RU": { lat: 61.524, lng: 105.3188 },
  "RW": { lat: -1.9403, lng: 29.8739 },
  "KN": { lat: 17.3578, lng: -62.783 },
  "LC": { lat: 13.9094, lng: -60.9789 },
  "VC": { lat: 12.9843, lng: -61.2872 },
  "WS": { lat: -13.759, lng: -172.1046 },
  "SM": { lat: 43.9424, lng: 12.4578 },
  "ST": { lat: 0.1864, lng: 6.6131 },
  "SA": { lat: 23.8859, lng: 45.0792 },
  "SN": { lat: 14.4974, lng: -14.4524 },
  "RS": { lat: 44.0165, lng: 21.0059 },
  "SC": { lat: -4.6796, lng: 55.492 },
  "SL": { lat: 8.4606, lng: -11.7799 },
  "SG": { lat: 1.3521, lng: 103.8198 },
  "SK": { lat: 48.669, lng: 19.699 },
  "SI": { lat: 46.1512, lng: 14.9955 },
  "SB": { lat: -9.6457, lng: 160.1562 },
  "SO": { lat: 5.1521, lng: 46.1996 },
  "ZA": { lat: -30.5595, lng: 22.9375 },
  "SS": { lat: 6.877, lng: 31.307 },
  "ES": { lat: 40.4637, lng: -3.7492 },
  "LK": { lat: 7.8731, lng: 80.7718 },
  "SD": { lat: 12.8628, lng: 30.2176 },
  "SR": { lat: 3.9193, lng: -56.0278 },
  "SE": { lat: 60.1282, lng: 18.6435 },
  "CH": { lat: 46.8182, lng: 8.2275 },
  "SY": { lat: 34.8021, lng: 38.9968 },
  "TJ": { lat: 38.861, lng: 71.2761 },
  "TZ": { lat: -6.369, lng: 34.8888 },
  "TH": { lat: 15.87, lng: 100.9925 },
  "TL": { lat: -8.8742, lng: 125.7275 },
  "TG": { lat: 8.6195, lng: 0.8248 },
  "TO": { lat: -21.179, lng: -175.1982 },
  "TT": { lat: 10.6918, lng: -61.2225 },
  "TN": { lat: 33.8869, lng: 9.5375 },
  "TR": { lat: 38.9637, lng: 35.2433 },
  "TM": { lat: 38.9697, lng: 59.5563 },
  "UG": { lat: 1.3733, lng: 32.2903 },
  "UA": { lat: 48.3794, lng: 31.1656 },
  "AE": { lat: 23.4241, lng: 53.8478 },
  "GB": { lat: 55.3781, lng: -3.436 },
  "US": { lat: 37.0902, lng: -95.7129 },
  "UY": { lat: -32.5228, lng: -55.7658 },
  "UZ": { lat: 41.3775, lng: 64.5853 },
  "VU": { lat: -15.3767, lng: 166.9592 },
  "VE": { lat: 6.4238, lng: -66.5897 },
  "VN": { lat: 14.0583, lng: 108.2772 },
  "YE": { lat: 15.5527, lng: 48.5164 },
  "ZM": { lat: -13.1339, lng: 27.8493 },
  "ZW": { lat: -19.0154, lng: 29.1549 }
};

// Convert ISO-2 → ISO-3 for GeoJSON matching
function normalizeCode(cc = "") {
  cc = cc.trim().toUpperCase();
  const map = window.__ISO2_TO_ISO3 || {
    "IN": "IND", "US": "USA", "AE": "ARE", "GB": "GBR", "AU": "AUS",
    "SG": "SGP", "ID": "IDN", "JP": "JPN", "CN": "CHN", "DE": "DEU",
    "FR": "FRA", "PK": "PAK", "LK": "LKA", "BD": "BGD", "NP": "NPL"
  };
  return map[cc] || cc;
}

function resolveCountryCode(raw = "") {
  if (!raw) return "";

  raw = raw.trim().toUpperCase();
  if (raw.length === 2) return raw;

  const guesses = {
    "INDIA": "IN",
    "BHARAT": "IN",
    "UNITED STATES": "US",
    "AMERICA": "US",
    "UAE": "AE",
    "DUBAI": "AE",
    "UK": "GB",
    "ENGLAND": "GB",
    "SINGAPORE": "SG"
  };

  return guesses[raw] || raw.slice(0,2);
}

// --- Convert Blessing to Pixel Position ---
// priority: 1) exact GPS if available  2) fallback to centroid
function getBlessingPixelPos(blessing, projection) {
    let lat = null, lng = null;

    // GPS → highest accuracy
    if (blessing.geo && blessing.geo.lat && blessing.geo.lng) {
        lat = parseFloat(blessing.geo.lat);
        lng = parseFloat(blessing.geo.lng);
    }

    // Fallback → centroid
    if (lat === null || lng === null) {
        const cc = (blessing.countryCode || "").toUpperCase();
        const c = COUNTRY_CENTROIDS[cc];   // FIXED
        if (c) {
            lat = c.lat;
            lng = c.lng;
        }
    }

    if (lat === null || lng === null) return null;

    const point = projection([lng, lat]);
    if (!point) return null;

    return { x: Math.round(point[0]), y: Math.round(point[1]) };
}

function initWorldMapD3() {
  const wrap = document.getElementById("mapWrap");
  if (!wrap) return;
  const svgContainer = document.getElementById("svgContainer");
  const dotLayer = document.getElementById("dotLayer");
  const globalCountNum = document.getElementById("globalCountNum");
  const drawer = document.getElementById("countryDrawer");
  const drawerClose = document.getElementById("drawerClose");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerList  = document.getElementById("drawerList");

  if (drawerClose) drawerClose.onclick = () => {
    drawer.classList.remove("open");
  };

  // ensure containers cleared
  svgContainer.innerHTML = "";
  dotLayer.innerHTML = "";

  // create svg element inside svgContainer (we keep plain DOM SVG for easier pixel sizing)
  const svg = d3.select(svgContainer)
                .append("svg")
                .attr("id", "d3WorldMap")
                .attr("preserveAspectRatio", "xMidYMid meet")
                .style("display", "block");

  // groups in svg (for country paths)
  const gCountries = svg.append("g").attr("class", "countries");

  // projection + path (will be reconfigured after geo load)
  const projection = d3.geoMercator()
    .scale(155)
    .translate([wrap.clientWidth / 2, wrap.clientHeight / 2])
    .center([0, 20]);

  const pathGen = d3.geoPath().projection(projection);

  // resize handler: set svg viewBox / container pixel sizes and also resize dotLayer
  function resizeEverything() {
      const rect = svgContainer.getBoundingClientRect();

      if (!rect.width || !rect.height) return;

      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      // Set SVG pixel size
      svg.attr("viewBox", `0 0 ${w} ${h}`)
         .attr("width", w)
         .attr("height", h);

      // HTML container sync
      svgContainer.style.width = `${w}px`;
      svgContainer.style.height = `${h}px`;

      // dotLayer must ALWAYS match SVG pixel area
      dotLayer.style.width = `${w}px`;
      dotLayer.style.height = `${h}px`;
      dotLayer.style.position = "absolute";
      dotLayer.style.left = "0px";
      dotLayer.style.top = "0px";
      dotLayer.style.pointerEvents = "auto";

      // Recalculate projection live
      projection.fitSize([w, h], window.__worldGeo);
  }

  // draw map + dots. We re-run on resize to keep pixel-perfect overlay.
  async function drawMap() {
    // clear previous
    gCountries.selectAll("*").remove();
    dotLayer.innerHTML = "";

    const { w, h } = getPixelSizeForWrap(wrap);

    // load geo + blessings in parallel (loadBlessingsForMap expected in your file)
    const [geo, blessings] = await Promise.all([
      d3.json(WORLD_JSON_URL),
      (typeof loadBlessingsForMap === "function") ? loadBlessingsForMap() : Promise.resolve([])
    ]);
    if (!geo) return;

    // store for placeDots()
    window.__worldGeo = geo;
    window.__d3Projection = projection;

    // fit projection to pixel canvas
    try {
      projection.fitSize([w, h], geo);
    } catch (e) {
      // fallback manual
      const b = d3.geoBounds(geo);
      const [[minLon, minLat], [maxLon, maxLat]] = b;
      const scale = 0.98 / Math.max((maxLon - minLon) / w, (maxLat - minLat) / h);
      projection.scale(scale * 140).translate([w / 2, h / 1.8]);
    }
    pathGen.projection(projection);

    const rect = svgContainer.getBoundingClientRect();
    projection.fitSize([rect.width, rect.height], geo);

    // draw countries
    gCountries.selectAll("path")
      .data(geo.features)
      .join("path")
      .attr("d", pathGen)
      .attr("fill", "#111318")
      .attr("stroke", "rgba(255,255,255,0.04)")
      .attr("stroke-width", 0.5);

    // Correct path selection (actual D3 rendered countries)
    d3.selectAll("g.countries path")
      .on("mouseenter", function () {
          d3.select(this).classed("country-hover", true);
      })
      .on("mouseleave", function () {
          d3.select(this).classed("country-hover", false);
      });

     
    // group blessings by country (use your helper if present)
    const grouped = (typeof groupByCountryFixed === "function") ? groupByCountryFixed(blessings, geo) : (function(){
      // fallback grouping: use explicit countryCode fields
      const r = {};
      (blessings || []).forEach(b => {
        const cc = (b.countryCode || "").toUpperCase() || "";
        if (!cc) return;
        if (!r[cc]) r[cc] = [];
        r[cc].push(b);
      });
      return r;
    })();

    // update global counter
    if (globalCountNum) animateCount(globalCountNum, (blessings || []).length || 0);

    window.__lastMapGroup = grouped;   // <-- store grouping globally for clicks

    // for each country place a dot (HTML div) on dotLayer using pixel centroid
    Object.keys(grouped).forEach(countryCode => {

        const list = grouped[countryCode] || [];
        let fullCountryName = list[0]?.country || "";

        // Standardize
        fullCountryName = (fullCountryName || "").trim();
        const code = countryCode.toUpperCase();

        // 1) Match by ISO
        const iso3 = normalizeCode(code);

        let feat = geo.features.find(f => {
          const p = f.properties || {};
          return (
            p.iso_a2?.toUpperCase() === code ||
            p.iso_a3?.toUpperCase() === iso3
          );
        });

        // 2) Exact country name match
        if (!feat) {
          feat = geo.features.find(f => {
            const p = f.properties || {};
            return (
              p.name?.toUpperCase() === fullCountryName.toUpperCase() ||
              p.name_long?.toUpperCase() === fullCountryName.toUpperCase()
            );
          });
        }

        // 3) Partial match
        if (!feat) {
          feat = geo.features.find(f => {
            const p = f.properties || {};
            return (
              p.name?.toUpperCase().includes(fullCountryName.toUpperCase()) ||
              p.name_long?.toUpperCase().includes(fullCountryName.toUpperCase())
            );
          });
        }

        if (!feat) return; // still nothing → skip

        // ---- SINGLE CLUSTER DOT PER COUNTRY ----
        const total = list.length;
        const pos = getBlessingPixelPos(list[0], projection);
        if (!pos) return;

        // auto scale dot
        let cls = "size-s";
        if (total > 1000) cls = "size-xl";
        else if (total > 100) cls = "size-l";
        else if (total > 10) cls = "size-m";

        const dot = document.createElement("div");
        dot.className = "country-dot " + cls;

        dot.style.left = pos.x + "px";
        dot.style.top = pos.y + "px";

        dot.onclick = (ev) => {
          ev.stopPropagation();
          setTimeout(() => openDrawer(countryCode, list), 20);
        };

        dotLayer.appendChild(dot);
    });
  } // drawMap

  // SAFE: open drawer (re-uses DOM area)
  function openDrawer(code, list){
    drawerTitle.textContent = `${code} — ${list.length} blessings`;
    drawerList.innerHTML = "";
    if (!list || list.length === 0) {
      drawerList.innerHTML = "<div style='color:var(--text-dim)'>No blessings found</div>";
    } else {
      list.slice(0, 200).forEach(b => {
        const c = document.createElement("div");
        c.className = "blessing-card";
        const username = b.username ? `<div style="color:var(--text-dim); font-size:12px; margin-top:6px">— ${escapeHTML(b.username)}</div>` : "";
        const time = timeAgo(b.timestamp || b.created) || "";
        c.innerHTML = `<div style="font-weight:600">${escapeHTML(b.text)}</div>${username}<div style="font-size:11px;color:var(--text-dim);margin-top:6px">${escapeHTML(time)}</div>`;
        drawerList.appendChild(c);
      });
    }
    drawer.classList.add("open");
    drawer.style.display = ""; // ensure visible
  }

  window.openDrawer = openDrawer;


  function escapeHTML(s){ return String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

  // initial sizing + draw
  resizeEverything();
  drawMap();

  // --- Keep map stable on orientation change / zoom / resize ---
  let safeTimer = null;
  window.addEventListener("resize", () => {
      clearTimeout(safeTimer);
      safeTimer = setTimeout(async () => {
          resizeEverything();
          await drawMap();
      }, 120);
  });

  // map is now ready → notify global listener
  window.dispatchEvent(new Event("d3-map-ready"));

  // on resize: recalc and redraw
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    // throttle resize
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeEverything();
      drawMap();
    }, 150);
  });

  // close drawer if user clicks outside
  window.addEventListener("click", (ev) => {
    if (!drawer.contains(ev.target)) {
      drawer.classList.remove("open");
    }
  });

  // expose helpers in case other code wants to refresh map
  window.initWorldMapD3 = initWorldMapD3; // noop self-ref
  window.redrawWorldMap = async () => { resizeEverything(); await drawMap(); };

} // initWorldMapD3()

// auto init when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("mapWrap")) initWorldMapD3();
});

function groupByCountryFixed(list = [], geo) {
    const out = {};

    list.forEach(b => {
        const cc = (b.countryCode || "").toUpperCase().trim();
        if (!cc) return;

        if (!out[cc]) out[cc] = [];
        out[cc].push(b);
    });

    return out;
}

/* ============================================================
   WORLD MAP — CONNECT FIREBASE → D3 (placeDots)
   ============================================================ */

async function loadBlessingsForMap() {
    const snap = await getDocs(
        query(collection(db, "blessings"), orderBy("timestamp", "desc"))
    );

    const blessings = [];

    snap.forEach(doc => {
        const d = doc.data();
        blessings.push({
            text: d.text || "",
            username: d.username || "",
            country: d.country || "",
            countryCode: (d.countryCode || "").toUpperCase(),
            geo: d.geo || null,     // <-- GPS SUPPORT (IMPORTANT)
            timestamp: d.timestamp || d.created
        });
    });

    return blessings;
}

window.loadBlessingsForMap = loadBlessingsForMap;

/* ============================================================
   REAL GALAXY MODE — TWINKLE + FLOAT + CONSTELLATION LINES
   ============================================================ */

(function () {
  const starCanvas = document.getElementById("mapStarsCanvas");
  const constelCanvas = document.getElementById("mapConstellationCanvas");

  if (!starCanvas || !constelCanvas) return;

  const sCtx = starCanvas.getContext("2d");
  const cCtx = constelCanvas.getContext("2d");

  let stars = [];
  let W = 0, H = 0;

  function resize() {
    W = starCanvas.parentElement.clientWidth;
    H = starCanvas.parentElement.clientHeight;

    starCanvas.width = W;
    starCanvas.height = H;

    constelCanvas.width = W;
    constelCanvas.height = H;

    initStars();
  }

  function initStars() {
    stars = [];
    const total = Math.floor((W * H) / 4800);

    for (let i = 0; i < total; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        base: Math.random() * 0.5 + 0.3,       
        pulse: Math.random() * 0.15 + 0.05,
        t: Math.random() * Math.PI * 2
      });
    }
  }

  function drawStars() {
    sCtx.clearRect(0, 0, W, H);

    for (let s of stars) {
      s.t += s.pulse;
      const glow = s.base + Math.sin(s.t) * 0.25;   // ⭐ twinkling

      const g = sCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
      g.addColorStop(0, `rgba(255,240,200,${glow})`);
      g.addColorStop(1, `rgba(255,240,200,0)`);

      sCtx.beginPath();
      sCtx.fillStyle = g;
      sCtx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2);
      sCtx.fill();
    }
  }

  function drawConstellations() {
    cCtx.clearRect(0, 0, W, H);
    cCtx.lineWidth = 0.8;
    cCtx.strokeStyle = "rgba(255,220,170,0.15)";
    
    cCtx.beginPath();

    for (let i = 0; i < stars.length - 1; i += 6) {
      const s1 = stars[i];
      const s2 = stars[i + 1];

      cCtx.moveTo(s1.x, s1.y);
      cCtx.lineTo(s2.x, s2.y);
    }

    cCtx.stroke();
  }

  function fadeConstellations() {
    cCtx.globalCompositeOperation = "destination-out";
    cCtx.fillStyle = "rgba(0,0,0,0.02)";
    cCtx.fillRect(0, 0, W, H);
    cCtx.globalCompositeOperation = "lighter";
  }

  function animate() {
    drawStars();
    drawConstellations();
    fadeConstellations(); // ⭐ smooth galaxy line fade
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);

  resize();
  animate();
})();
