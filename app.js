// Firebase (CDN modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  query,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔐 Your Firebase config (from your console; already shared earlier)
const firebaseConfig = {
  apiKey: "AIzaSyC8CzspwB_GtrbUm-V2mIvumpPqbbq-f6k",
  authDomain: "world-blessing-wall.firebaseapp.com",
  projectId: "world-blessing-wall",
  storageBucket: "world-blessing-wall.firebasestorage.app",
  messagingSenderId: "552766948715",
  appId: "1:552766948715:web:427d27f309a2c2c345782e"
};

// Init
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// UI refs
const blessingInput = document.getElementById("blessingInput");
const countryInput  = document.getElementById("countryInput");
const sendBtn       = document.getElementById("sendBtn");
const statusEl      = document.getElementById("status");
const listEl        = document.getElementById("blessingsList");
const counterEl     = document.getElementById("counter");

// Submit blessing
sendBtn.addEventListener("click", async () => {
  const text = blessingInput.value.trim();
  const country = countryInput.value.trim() || "Unknown";

  if (!text) {
    status("Please write something 🙏", "err");
    return;
  }

  try {
    await addDoc(collection(db, "blessings"), {
      text,
      country,
      created: serverTimestamp(),
      approved: true
    });
    blessingInput.value = "";
    status("Blessing submitted ✅");
  } catch (e) {
    console.error(e);
    status("Error, try again.", "err");
  }
});

function status(msg, type="ok"){
  statusEl.textContent = msg;
  statusEl.style.color = type === "ok" ? "#97f7b2" : "#ffb3b3";
  setTimeout(()=> statusEl.textContent = "", 2500);
}

// Live feed + counter
const q = query(collection(db, "blessings"), orderBy("created","desc"), limit(100));

onSnapshot(q, (snap) => {
  // Counter (approved count visible from snapshot subset: best-effort)
  animateCount(counterEl, snap.size);

  // Cards
  listEl.innerHTML = "";
  snap.forEach(doc => {
    const d = doc.data();
    const card = document.createElement("div");
    card.className = "card";
    const when = d.created?.toDate ? d.created.toDate() : new Date();
    card.innerHTML = `
      <div class="meta"><strong>${escapeHTML(d.country || "—")}</strong></div>
      <div>${escapeHTML(d.text || "")}</div>
      <div class="time">${when.toLocaleString()}</div>
    `;
    listEl.appendChild(card);
  });
});

// Simple animated counter
function animateCount(el, target){
  const current = parseInt(el.textContent || "0", 10);
  if (current === target) return;
  const diff = target - current;
  const step = Math.max(1, Math.floor(Math.abs(diff) / 12));
  const dir  = diff > 0 ? 1 : -1;
  const tick = () => {
    const val = parseInt(el.textContent || "0", 10) + (step * dir);
    if ((dir>0 && val >= target) || (dir<0 && val <= target)) {
      el.textContent = String(target);
    } else {
      el.textContent = String(val);
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

// Share buttons
const url = window.location.href;
document.getElementById("waShare").onclick  = () => window.open(`https://wa.me/?text=${encodeURIComponent("Write a blessing on the World Blessing Wall 💫 " + url)}`);
document.getElementById("twShare").onclick  = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent("Write a blessing on the World Blessing Wall 💫")}&url=${encodeURIComponent(url)}`);
document.getElementById("copyShare").onclick= async () => {
  try{ await navigator.clipboard.writeText(url); status("Link copied ✅"); }catch(e){ status("Copy failed", "err"); }
};

// tiny XSS guard
function escapeHTML(s=""){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
