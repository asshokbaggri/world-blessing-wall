/* ============================================================
   WORLD BLESSING WALL — APP.JS v1.4 (Viral + Username Modal)
   Clean + stable + fully working version
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
const db = getFirestore(app);

/* ---------------- DOM Elements ---------------- */
const blessingInput = document.getElementById("blessingInput");
const countryInput = document.getElementById("countryInput");
const sendBtn = document.getElementById("sendBtn");
const statusBox = document.getElementById("status");
const blessingsList = document.getElementById("blessingsList");
const counterEl = document.getElementById("counter");
const loadMoreBtn = document.getElementById("loadMore");
const noMoreEl = document.getElementById("noMore");

const waShare = document.getElementById("waShare");
const twShare = document.getElementById("twShare");
const copyShare = document.getElementById("copyShare");

/* My blessings */
const myList = document.getElementById("myBlessingsList");
const myEmpty = document.getElementById("myEmpty");
const toggleMy = document.getElementById("toggleMy");
const refreshMy = document.getElementById("refreshMy");
const myCountEl = document.getElementById("myCount");

/* Username modal */
const usernamePopup = document.getElementById("usernamePopup");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsername");
const skipUsernameBtn = document.getElementById("skipUsername");

/* Effects */
const sparkleRoot = document.getElementById("sparkleBurst");
const liveToast = document.getElementById("liveToast");
const titleEl = document.querySelector(".title");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------------- STATE ---------------- */
const renderedIds = new Set();
let lastDoc = null;
let initialLoaded = false;
let loadingMore = false;
const PAGE_LIMIT = 12;

/* ---------------- Client ID ---------------- */
function getClientId() {
  try {
    const key = "wbw_client_id_v1";
    let id = localStorage.getItem(key);
    if (id) return id;

    const arr = crypto.getRandomValues(new Uint8Array(12));
    id = [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(key, id);
    return id;
  } catch {
    let id = "x" + Date.now().toString(36);
    try { localStorage.setItem("wbw_client_id_v1", id); } catch {}
    return id;
  }
}
const CLIENT_ID = getClientId();

async function makeIpHash() {
  const seed = `${CLIENT_ID}::${navigator.userAgent}`;
  const data = new TextEncoder().encode(seed);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------------- Utils ---------------- */

function escapeHTML(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function detectLang(txt = "") {
  const dev = (txt.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (txt.match(/[A-Za-z]/g) || []).length;
  if (dev > 3 && dev > lat) return "hi";
  return "en";
}

/* Normalize country → clean + simple */
function normalizeCountry(input = "") {
  const raw = (input || "").trim().toLowerCase();
  if (!raw) return { country: "", countryCode: "" };

  const map = {
    india: ["IN", "India"],
    in: ["IN", "India"],
    bharat: ["IN", "India"],

    usa: ["US", "United States"],
    us: ["US", "United States"],

    dubai: ["AE", "United Arab Emirates"],
    uae: ["AE", "United Arab Emirates"],

    uk: ["GB", "United Kingdom"],
    england: ["GB", "United Kingdom"],
  };

  if (map[raw]) return { country: map[raw][1], countryCode: map[raw][0] };
  const cc = raw.slice(0, 2).toUpperCase();
  return { country: input, countryCode: cc };
}

/* Flag emoji */
function flagFromCode(cc = "") {
  if (!cc || cc.length !== 2) return "🌍";
  return String.fromCodePoint(
    0x1F1E6 + (cc.charCodeAt(0) - 65),
    0x1F1E6 + (cc.charCodeAt(1) - 65)
  );
}

/* Instagram style timeAgo */
function timeAgo(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  return date.toLocaleString();
}

/* ---------------- Username Modal ---------------- */
function openUsernamePopup() {
  usernamePopup.hidden = false;
  usernamePopup.classList.add("show");
  usernameInput.focus();
}

function closeUsernamePopup() {
  usernamePopup.classList.remove("show");
  setTimeout(() => usernamePopup.hidden = true, 200);
}

function getSavedUsername() {
  return localStorage.getItem("wbw_username_v1")?.trim() || "";
}

async function ensureUsernameModal() {
  const saved = getSavedUsername();
  if (saved) return saved;

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

/* ---------------- Make Card ---------------- */
function makeCard(data = {}, id) {
  const country = data.country || "";
  const cc = (data.countryCode || "").toUpperCase();
  const flag = flagFromCode(cc);
  const user = data.username || "";
  const relTime = timeAgo(data.timestamp || data.created);

  const el = document.createElement("div");
  el.className = "blessing-card fade-up";
  el.dataset.id = id;

  el.innerHTML = `
    <b class="blessing-flag"><span>${flag}</span> ${escapeHTML(country || cc)}</b>
    <div class="blessing-text">${escapeHTML(data.text || "").replace(/\n/g, "<br>")}</div>
    ${user ? `<div class="blessing-user">— ${escapeHTML(user)}</div>` : ""}
    <div class="blessing-time">${escapeHTML(relTime)}</div>
  `;

  return el;
}

/* ---------------- Render ---------------- */

function appendIfNew(d) {
  if (renderedIds.has(d.id)) return false;
  blessingsList.appendChild(makeCard(d.data(), d.id));
  renderedIds.add(d.id);
  return true;
}

function prependIfNew(d) {
  if (renderedIds.has(d.id)) return false;
  blessingsList.prepend(makeCard(d.data(), d.id));
  renderedIds.add(d.id);
  return true;
}

/* ---------------- Initial Load ---------------- */
async function loadInitial() {
  const q1 = query(
    collection(db, "blessings"),
    orderBy("timestamp", "desc"),
    limit(PAGE_LIMIT)
  );

  const snap = await getDocs(q1);

  blessingsList.innerHTML = "";
  renderedIds.clear();

  snap.docs.forEach(d => appendIfNew(d));
  lastDoc = snap.docs[snap.docs.length - 1] || null;

  animateCount(counterEl, renderedIds.size);
  initialLoaded = true;

  revealOnScroll();
  setupInfiniteObserver();
}
loadInitial();

/* ---------------- Load More ---------------- */
async function loadMore() {
  if (!lastDoc || loadingMore) return;

  loadingMore = true;
  loadMoreBtn.disabled = true;

  const q = query(
    collection(db, "blessings"),
    orderBy("timestamp", "desc"),
    startAfter(lastDoc),
    limit(PAGE_LIMIT)
  );

  const snap = await getDocs(q);

  snap.docs.forEach(d => appendIfNew(d));
  lastDoc = snap.docs[snap.docs.length - 1] || null;

  loadingMore = false;
  loadMoreBtn.disabled = false;
}
loadMoreBtn.onclick = loadMore;

/* ---------------- Infinite Scroll ---------------- */
let infiniteObserver = null;

function setupInfiniteObserver() {
  if (infiniteObserver) return;

  const sentinel = document.createElement("div");
  sentinel.id = "wbw_sentinel";
  blessingsList.insertAdjacentElement("afterend", sentinel);

  infiniteObserver = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting) {
      await loadMore();
    }
  });

  infiniteObserver.observe(sentinel);
}

/* ---------------- Realtime Top ---------------- */
const liveNewest = query(
  collection(db, "blessings"),
  orderBy("timestamp", "desc"),
  limit(1)
);

onSnapshot(liveNewest, (snap) => {
  if (!initialLoaded) return;

  snap.docChanges().forEach(change => {
    if (change.type === "added") {
      if (prependIfNew(change.doc)) {
        animateCount(counterEl, renderedIds.size);
        triggerSparkle(10);
      }
    }
  });
});

/* ---------------- My Blessings ---------------- */
let myUnsub = null;

async function startMyBlss() {
  const ipHash = await makeIpHash();

  const myQuery = query(
    collection(db, "blessings"),
    where("ipHash", "==", ipHash),
    orderBy("timestamp", "desc"),
    limit(60)
  );

  if (myUnsub) myUnsub();

  myUnsub = onSnapshot(myQuery, (snap) => {
    myList.innerHTML = "";

    if (snap.empty) {
      myEmpty.textContent = "You haven’t posted any blessings yet 🌼";
      animateCount(myCountEl, 0);
      return;
    }

    snap.docs.forEach(d => {
      myList.appendChild(makeCard(d.data(), d.id));
    });

    animateCount(myCountEl, snap.docs.length);
    myEmpty.textContent = "";
  });
}

toggleMy.onclick = () => {
  const sec = document.getElementById("myBlessings");
  sec.style.display = sec.style.display === "none" ? "" : "none";
};

refreshMy.onclick = startMyBlss;
startMyBlss();

/* ---------------- Submit Blessing ---------------- */
async function submitBlessing() {
  const text = blessingInput.value.trim();
  const rawCountry = countryInput.value.trim();
  if (!text) return blessingInput.focus();
  if (!rawCountry) return countryInput.focus();

  sendBtn.disabled = true;
  sendBtn.style.opacity = ".6";

  const username = await ensureUsernameModal();
  if (!username) {
    sendBtn.disabled = false;
    sendBtn.style.opacity = "1";
    return;
  }

  const lang = detectLang(text);
  const { country, countryCode } = normalizeCountry(rawCountry);
  const ipHash = await makeIpHash();

  const base = {
    text,
    country,
    countryCode,
    language: lang,
    timestamp: serverTimestamp(),
    created: serverTimestamp(),
    username,
    ipHash,
    sentimentScore: 0,
    status: "approved",
    device: "web",
    source: document.referrer ? new URL(document.referrer).hostname : "direct",
    blessingId: ""
  };

  const ref = await addDoc(collection(db, "blessings"), base);
  await updateDoc(doc(db, "blessings", ref.id), { blessingId: ref.id });

  pulseSendBtn();
  triggerSparkle(14);
  showLiveToast("✨ Your blessing is live!");

  blessingInput.value = "";
  sendBtn.disabled = false;
  sendBtn.style.opacity = "1";
}
sendBtn.onclick = submitBlessing;

blessingInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
});

/* ---------------- Share ---------------- */
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl = encodeURIComponent(location.href.split("#")[0]);

waShare.onclick = () =>
  window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`);

twShare.onclick = () =>
  window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`);

copyShare.onclick = async () => {
  await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
  const prev = copyShare.textContent;
  copyShare.textContent = "Link Copied ✅";
  await sleep(1100);
  copyShare.textContent = prev;
};

/* ---------------- Particles ---------------- */
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

  const COUNT = Math.floor((W * H) / 35000) + 80;
  const stars = Array.from({ length: COUNT }).map(() => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.4 + 0.4,
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

      const glow = 0.6 + 0.35 * Math.sin(s.tw);
      ctx.globalAlpha = glow;

      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 7);
      g.addColorStop(0, "rgba(255,240,200,1)");
      g.addColorStop(1, "rgba(255,240,200,0)");
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

/* ---------------- Scroll Reveal ---------------- */
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

console.info("World Blessing Wall — app.js v1.4 loaded ✨ Viral Mode Activated");
