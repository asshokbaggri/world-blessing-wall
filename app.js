/* ============================================================
   WORLD BLESSING WALL — APP.JS v1.3 (VIRAL MODE + Username Modal)
   - Modern username popup (HTML modal, not prompt)
   - Username saved in localStorage + in every blessing
   - Viral card layout (Flag → Text → — Username → Relative Time)
   - Instagram/TikTok style "time ago"
   - My Blessings realtime + count animation
   ============================================================ */

/* ---------------- Firebase Init ---------------- */
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

/* ---------------- DOM ---------------- */
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

// My blessings
const myList = document.getElementById("myBlessingsList");
const myEmpty = document.getElementById("myEmpty");
const toggleMy = document.getElementById("toggleMy");
const refreshMy = document.getElementById("refreshMy");
const myCountEl = document.getElementById("myCount");

/* Username modal DOM */
const usernamePopup = document.getElementById("usernamePopup");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsername");
const skipUsernameBtn = document.getElementById("skipUsername");

let sparkleRoot = document.getElementById("sparkleBurst");
let liveToast   = document.getElementById("liveToast");
const titleEl   = document.querySelector(".title");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------------- STATE ---------------- */
const renderedIds = new Set();
let lastDoc = null;
let initialLoaded = false;
let loadingMore = false;
const PAGE_LIMIT = 12;

/* -------- Persistent Client ID -------- */
function getClientId(){
  try {
    const key = "wbw_client_id_v1";
    let id = localStorage.getItem(key);
    if (id) return id;

    const arr = crypto.getRandomValues(new Uint8Array(12));
    id = [...arr].map(b=>b.toString(16).padStart(2,"0")).join("");
    localStorage.setItem(key, id);
    return id;
  } catch(e){
    const id = "x" + Date.now().toString(36);
    try { localStorage.setItem("wbw_client_id_v1", id); } catch {}
    return id;
  }
}
const CLIENT_ID = getClientId();

async function makeIpHash(){
  const seed = `${CLIENT_ID}::${navigator.userAgent}::${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(seed);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  let h=0; for (let i=0;i<seed.length;i++){ h=(h*31+seed.charCodeAt(i))|0; }
  return String(h>>>0);
}

/* ---------------- UTILS ---------------- */

// Escape unsafe HTML
function escapeHTML(s=""){
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

// Language detect
function detectLang(txt=""){
  const dev = (txt.match(/[\u0900-\u097F]/g)||[]).length;
  const lat = (txt.match(/[A-Za-z]/g)||[]).length;
  if (dev > 3 && dev > lat) return "hi";
  return "en";
}

// Normalize country
function normalizeCountry(input=""){
  const raw = (input||"").trim();
  if (!raw) return {country:"", countryCode:""};

  const map = {
    "india":["IN","India"], "in":["IN","India"], "bharat":["IN","India"],
    "usa":["US","United States"], "us":["US","United States"],
    "uae":["AE","United Arab Emirates"], "dubai":["AE","United Arab Emirates"],
    "uk":["GB","United Kingdom"], "england":["GB","United Kingdom"],
  };

  const parts = raw.split(/\s+/);
  if (parts[0].length === 2){
    const cc = parts[0].toUpperCase();
    const rest = parts.slice(1).join(" ");
    return { country: rest || cc, countryCode: cc };
  }

  const key = raw.toLowerCase();
  if (map[key]) return {country: map[key][1], countryCode: map[key][0]};

  const cc = raw.slice(0,2).toUpperCase();
  return { country: raw, countryCode: cc };
}

// Flag emoji
function flagFromCode(cc=""){
  if (!cc || cc.length!==2) return "🌍";
  try {
    return String.fromCodePoint(
      0x1F1E6 + (cc.charCodeAt(0)-65),
      0x1F1E6 + (cc.charCodeAt(1)-65)
    );
  } catch {
    return "🌍";
  }
}

// Relative Time (Instagram style)
function timeAgo(ts){
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - date.getTime())/1000);

  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec/60);
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.floor(min/60);
  if (hr < 24) return `${hr} hours ago`;
  const day = Math.floor(hr/24);
  if (day < 7) return `${day} days ago`;
  return date/* ============================================================
   PART 2/2 — CARD BUILDER, FEEDS, PAGINATION, USERNAME MODAL,
   SUBMIT, PARTICLES, SHARE, EVERYTHING FINAL + VIRAL MODE
   ============================================================ */

/* -------------------- Username Modal Logic -------------------- */
function openUsernamePopup() {
  usernamePopup.removeAttribute("hidden");
  usernamePopup.classList.add("show");
  usernameInput.focus();
}

function closeUsernamePopup() {
  usernamePopup.classList.remove("show");
  setTimeout(() => usernamePopup.setAttribute("hidden", true), 200);
}

function getSavedUsername() {
  return localStorage.getItem("wbw_username_v1")?.trim() || "";
}

async function ensureUsernameModal() {
  let current = getSavedUsername();
  if (current) return current;

  openUsernamePopup();

  return new Promise((resolve) => {
    saveUsernameBtn.onclick = () => {
      const val = usernameInput.value.trim();
      if (!val) {
        alert("Naam khaali nahi ho sakta ❤️");
        return;
      }
      localStorage.setItem("wbw_username_v1", val);
      closeUsernamePopup();
      resolve(val);
    };

    skipUsernameBtn.onclick = () => {
      alert("Blessing post karne ke liye naam zaroori hai 🙏");
      resolve(null);
    };
  });
}

/* -------------------- Card Builder -------------------- */
function makeCard(docData = {}, docId) {
  const data = docData || {};
  const country = (data.country || "").trim();
  const cc = (data.countryCode || "").toUpperCase();
  const flag = flagFromCode(cc);

  const username = data.username ? escapeHTML(data.username) : "";

  let relTime = "";
  try {
    const ts = data.timestamp || data.created;
    relTime = timeAgo(ts);
  } catch {
    relTime = "";
  }

  const wrap = document.createElement("div");
  wrap.classList.add("blessing-card", "fade-up");
  if (docId) wrap.dataset.id = docId;

  wrap.innerHTML = `
    <b class="blessing-flag">
      <span class="flag">${flag}</span> ${escapeHTML(country || cc || "—")}
    </b>

    <div class="blessing-text">${escapeHTML(data.text || "").replace(/\n/g,"<br>")}</div>

    ${username ? `<div class="blessing-user">— ${username}</div>` : ""}

    <div class="blessing-time">${escapeHTML(relTime)}</div>
  `;

  return wrap;
}

/* -------------------- Render Helpers -------------------- */
function prependIfNew(docSnap) {
  const id = docSnap.id;
  if (renderedIds.has(id)) return false;

  const el = makeCard(docSnap.data(), id);
  blessingsList.prepend(el);
  renderedIds.add(id);
  return true;
}

function appendIfNew(docSnap) {
  const id = docSnap.id;
  if (renderedIds.has(id)) return false;

  const el = makeCard(docSnap.data(), id);
  blessingsList.appendChild(el);
  renderedIds.add(id);
  return true;
}

/* -------------------- Initial Load -------------------- */
async function loadInitial() {
  try {
    const q1 = query(
      collection(db, "blessings"),
      orderBy("timestamp", "desc"),
      limit(PAGE_LIMIT)
    );

    const snap = await getDocs(q1);

    blessingsList.innerHTML = "";
    renderedIds.clear();

    snap.docs.forEach((d) => appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    initialLoaded = true;

    animateCount(counterEl, renderedIds.size);

    if (!lastDoc) {
      loadMoreBtn.style.display = "none";
      noMoreEl.textContent = "No more blessings 🤍";
    } else {
      loadMoreBtn.style.display = "block";
      noMoreEl.textContent = "";
    }

    revealOnScroll();
    setupInfiniteObserver();
  } catch (err) {
    console.warn("Initial load failed", err);
    statusBox.textContent = "Unable to load blessings right now.";
  }
}
loadInitial();

/* -------------------- Load More -------------------- */
async function loadMore() {
  if (loadingMore) return;
  if (!lastDoc) {
    loadMoreBtn.style.display = "none";
    noMoreEl.textContent = "No more blessings 🤍";
    return;
  }

  loadingMore = true;
  loadMoreBtn.disabled = true;

  try {
    const qMore = query(
      collection(db, "blessings"),
      orderBy("timestamp", "desc"),
      startAfter(lastDoc),
      limit(PAGE_LIMIT)
    );

    const snap = await getDocs(qMore);

    if (snap.empty) {
      lastDoc = null;
      loadMoreBtn.style.display = "none";
      noMoreEl.textContent = "No more blessings 🤍";
      return;
    }

    snap.docs.forEach((d) => appendIfNew(d));
    lastDoc = snap.docs[snap.docs.length - 1] || null;

    revealOnScroll();
  } catch (err) {
    statusBox.textContent = "Failed to load more.";
  } finally {
    loadingMore = false;
    loadMoreBtn.disabled = false;
  }
}
loadMoreBtn.addEventListener("click", loadMore);

/* -------------------- Infinite Scroll -------------------- */
let infiniteObserver = null;
let sentinel = null;

function createSentinel() {
  if (document.getElementById("wbw_sentinel"))
    return document.getElementById("wbw_sentinel");

  sentinel = document.createElement("div");
  sentinel.id = "wbw_sentinel";
  sentinel.style.width = "1px";
  sentinel.style.height = "1px";
  sentinel.style.margin = "1px auto";

  blessingsList.insertAdjacentElement("afterend", sentinel);
  return sentinel;
}

function setupInfiniteObserver() {
  if (infiniteObserver) return;

  sentinel = createSentinel();

  infiniteObserver = new IntersectionObserver(
    async (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && initialLoaded && !loadingMore && lastDoc) {
          await loadMore();
        }
      }
    },
    {
      root: null,
      rootMargin: "380px",
      threshold: 0,
    }
  );

  infiniteObserver.observe(sentinel);
}

/* -------------------- Live Realtime Top -------------------- */
const liveNewest = query(
  collection(db, "blessings"),
  orderBy("timestamp", "desc"),
  limit(1)
);

onSnapshot(liveNewest, (snap) => {
  if (!initialLoaded) return;

  snap.docChanges().forEach((change) => {
    if (change.type === "added") {
      const added = prependIfNew(change.doc);
      if (added) {
        animateCount(counterEl, renderedIds.size);
        triggerSparkle(10);
      }
      revealOnScroll();
    }
  });
});

/* -------------------- My Blessings -------------------- */
let myUnsub = null;

async function startMyBlss() {
  myList.innerHTML = "";
  myEmpty.textContent = "Loading…";

  try {
    const ipHash = await makeIpHash();

    const myQuery = query(
      collection(db, "blessings"),
      where("ipHash", "==", ipHash),
      orderBy("timestamp", "desc"),
      limit(60)
    );

    if (typeof myUnsub === "function") myUnsub();

    myUnsub = onSnapshot(
      myQuery,
      (snap) => {
        myList.innerHTML = "";

        if (snap.empty) {
          myEmpty.textContent = "You haven’t posted any blessings yet 🌟";
          animateCount(myCountEl, 0);
          return;
        }

        myEmpty.textContent = "";

        snap.docs.forEach((d) => {
          myList.appendChild(makeCard(d.data(), d.id));
        });

        animateCount(myCountEl, snap.docs.length);
      },
      () => {
        myEmpty.textContent = "Unable to load your blessings.";
      }
    );
  } catch {
    myEmpty.textContent = "Unable to load your blessings.";
  }
}

toggleMy.onclick = () => {
  const sec = document.getElementById("myBlessings");
  if (!sec) return;

  if (sec.style.display === "none") {
    sec.style.display = "";
    toggleMy.textContent = "Hide My Blessings";
  } else {
    sec.style.display = "none";
    toggleMy.textContent = "Show My Blessings";
  }
};

refreshMy.onclick = () => startMyBlss();

startMyBlss();

/* -------------------- SUBMIT FLOW -------------------- */
sendBtn.addEventListener("click", submitBlessing);

blessingInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
});

async function submitBlessing() {
  const rawText = blessingInput.value.trim();
  const rawCountry = countryInput.value.trim();

  if (!rawText) {
    blessingInput.focus();
    return;
  }
  if (!rawCountry) {
    countryInput.focus();
    return;
  }

  sendBtn.disabled = true;
  sendBtn.style.opacity = ".6";

  try {
    const username = await ensureUsernameModal();
    if (!username) return;

    const lang = detectLang(rawText);
    const { country, countryCode } = normalizeCountry(rawCountry);
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
      source: document.referrer ? new URL(document.referrer).hostname : "direct",
      blessingId: ""
    };

    const ref = await addDoc(collection(db, "blessings"), base);

    await updateDoc(doc(db, "blessings", ref.id), {
      blessingId: ref.id,
    });

    getGeoOnce().then((geo) => {
      if (geo) {
        updateDoc(doc(db, "blessings", ref.id), {
          "geo.lat": geo.lat,
          "geo.lng": geo.lng,
        });
      }
    });

    pulseSendBtn();
    triggerSparkle(14);
    showLiveToast("✨ Your blessing is live!");

    blessingInput.value = "";

    await sleep(900);
    statusBox.textContent = "";

    startMyBlss();
  } finally {
    sendBtn.disabled = false;
    sendBtn.style.opacity = "1";
  }
}

/* -------------------- SHARE -------------------- */
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl = encodeURIComponent(location.href.split("#")[0]);

waShare.onclick = () => {
  window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`, "_blank");
};

twShare.onclick = () => {
  window.open(
    `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
    "_blank"
  );
};

copyShare.onclick = async () => {
  await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
  const prev = copyShare.textContent;
  copyShare.textContent = "Link Copied ✅";
  await sleep(1000);
  copyShare.textContent = prev;
};

/* -------------------- PARTICLES -------------------- */
(function initParticles() {
  const canvas = document.getElementById("goldParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H, dpr;

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

  animate();
})();

/* -------------------- Scroll Reveal -------------------- */
function revealOnScroll() {
  const els = document.querySelectorAll(".fade-up, .fade-section");
  const trigger = window.innerHeight * 0.92;

  els.forEach((el) => {
    if (el.getBoundingClientRect().top < trigger) {
      el.classList.add("show");
    }
  });
}

window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);

console.info("World Blessing Wall — app.js v1.3 loaded 💫 (Viral Mode)");
.toLocaleString();
}
