/* ===========================================================
   WORLD BLESSING WALL — HYBRID V2.1 (REALTIME + LOADMORE FIXED)
   =========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot
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

// DOM
const blessingInput = document.getElementById("blessingInput");
const countryInput = document.getElementById("countryInput");
const sendBtn = document.getElementById("sendBtn");
const blessingsList = document.getElementById("blessingsList");
const loadMoreBtn = document.getElementById("loadMore");
const noMoreText = document.getElementById("noMore");
const counterEl = document.getElementById("counter");
const statusBox = document.getElementById("status");

// Pagination
let lastVisible = null;
let loadingMore = false;
let initialLoaded = false;

// ---------------- MAKE CARD ----------------
function makeCard(data) {
  const wrap = document.createElement("div");
  wrap.className = "blessing-card fade-up";

  const timeStr = data.created?.toDate
    ? data.created.toDate().toLocaleString()
    : new Date().toLocaleString();

  wrap.innerHTML = `
    <b>🇮🇳 ${data.country}</b>
    <div>${(data.text || "").replace(/\n/g, "<br>")}</div>
    <small>${timeStr}</small>
  `;

  return wrap;
}

// ---------------- SUBMIT ----------------
async function submitBlessing() {
  const text = blessingInput.value.trim();
  const country = countryInput.value.trim();

  if (!text) return;
  if (!country) return;

  sendBtn.disabled = true;

  await addDoc(collection(db, "blessings"), {
    text,
    country,
    created: serverTimestamp(),
    approved: true
  });

  blessingInput.value = "";
  statusBox.textContent = "Blessing submitted ✅";
  setTimeout(() => (statusBox.textContent = ""), 1200);

  sendBtn.disabled = false;
}

sendBtn.addEventListener("click", submitBlessing);

// ---------------- REALTIME LISTENER (TOP 10 NEWEST) ----------------
const liveQuery = query(
  collection(db, "blessings"),
  orderBy("created", "desc"),
  limit(10)
);

onSnapshot(liveQuery, (snap) => {
  if (!initialLoaded) return; // loadMore load hone tak wait

  blessingsList.innerHTML = "";

  snap.docs.forEach((doc) => {
    blessingsList.appendChild(makeCard(doc.data()));
  });

  animateCount(counterEl, snap.size);
});

// ---------------- FIRST LOAD (FULL) ----------------
async function loadInitial() {
  const q = query(
    collection(db, "blessings"),
    orderBy("created", "desc"),
    limit(10)
  );

  const snap = await getDocs(q);

  blessingsList.innerHTML = "";
  snap.docs.forEach((doc) => blessingsList.appendChild(makeCard(doc.data())));

  lastVisible = snap.docs[snap.docs.length - 1];

  initialLoaded = true;

  if (snap.size < 10) loadMoreBtn.style.display = "none";
}

loadInitial();

// ---------------- LOAD MORE ----------------
loadMoreBtn.addEventListener("click", async () => {
  if (loadingMore || !lastVisible) return;
  loadingMore = true;

  const q = query(
    collection(db, "blessings"),
    orderBy("created", "desc"),
    startAfter(lastVisible),
    limit(10)
  );

  const snap = await getDocs(q);

  snap.docs.forEach((doc) => blessingsList.appendChild(makeCard(doc.data())));

  if (snap.docs.length < 10) {
    loadMoreBtn.style.display = "none";
    noMoreText.innerHTML = "No more 🙏";
  }

  lastVisible = snap.docs[snap.docs.length - 1];
  loadingMore = false;
});

// ---------------- COUNTER ----------------
function animateCount(el, to) {
  const from = Number(el.textContent || 0);
  const duration = 400;
  const start = performance.now();

  function frame(t) {
    const p = Math.min(1, (t - start) / duration);
    el.textContent = Math.round(from + (to - from) * p);
    if (p < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
