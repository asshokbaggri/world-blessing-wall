// ===============================
//  FIREBASE IMPORTS
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ===============================
//  FIREBASE CONFIG
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyC8CzspwB_GtrbUm-V2mIvumpPqbbq-f6k",
  authDomain: "world-blessing-wall.firebaseapp.com",
  projectId: "world-blessing-wall",
  storageBucket: "world-blessing-wall.firebasestorage.app",
  messagingSenderId: "552766948715",
  appId: "1:552766948715:web:427d27f309a2c2c345782e"
};


// ===============================
//  INIT FIREBASE
// ===============================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ===============================
//  ELEMENTS
// ===============================
const blessingInput = document.getElementById("blessingInput");
const countryInput  = document.getElementById("countryInput");
const sendBtn       = document.getElementById("sendBtn");
const statusBox     = document.getElementById("status");
const blessingsList = document.getElementById("blessingsList");
const counter       = document.getElementById("counter");


// ===============================
//  ADD BLESSING
// ===============================
sendBtn.addEventListener("click", async () => {
  const text = blessingInput.value.trim();
  const country = countryInput.value.trim();

  if (!text) {
    alert("Baby, blessing likho 😇");
    return;
  }
  if (!country) {
    alert("Country daal do baby 🌍");
    return;
  }

  // ✅ Send to Firestore
  await addDoc(collection(db, "blessings"), {
    text,
    country,
    created: serverTimestamp(),
    approved: true
  });

  // Clear input + show status
  blessingInput.value = "";
  statusBox.textContent = "Blessing submitted 💛✨";

  setTimeout(() => { statusBox.textContent = ""; }, 2000);
});


// ===============================
//  LIVE REAL-TIME LISTENER
// ===============================
const q = query(
  collection(db, "blessings"),
  orderBy("created", "desc")
);

onSnapshot(q, (snapshot) => {
  blessingsList.innerHTML = "";
  counter.textContent = snapshot.docs.length;

  snapshot.forEach(doc => {
    const d = doc.data();

    const div = document.createElement("div");
    div.className = "blessing-card";

    const time = d.created?.toDate
      ? d.created.toDate().toLocaleString()
      : "Just now";

    div.innerHTML = `
      <b style="color:#ffda74">${d.country}</b><br>
      ${d.text}<br>
      <small style="opacity:0.7">${time}</small>
    `;

    blessingsList.appendChild(div);
  });
});


// ===============================
//  SHARE BUTTONS
// ===============================
document.getElementById("waShare").onclick = () => {
  window.open("https://wa.me/?text=Write%20a%20blessing%20here:%20" + location.href);
};

document.getElementById("twShare").onclick = () => {
  window.open("https://twitter.com/intent/tweet?text=Write%20a%20blessing%20here:%20" + location.href);
};

document.getElementById("copyShare").onclick = () => {
  navigator.clipboard.writeText(location.href);
  alert("Link copied ✅");
};

/* ------------------------------------------------------
   GOLDEN FLOATING PARTICLES 
------------------------------------------------------ */

const canvas = document.getElementById("goldParticles");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const particles = [];

for (let i = 0; i < 70; i++) {
  particles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 1,
    dx: Math.random() * 0.4 - 0.2,
    dy: Math.random() * 0.4 - 0.2
  });
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 204, 77, 0.6)";
    ctx.fill();

    p.x += p.dx;
    p.y += p.dy;

    if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
  });

  requestAnimationFrame(animateParticles);
}
animateParticles();

/* ------------------------------------------------------
   FADE-IN EFFECT FOR SECTIONS 
------------------------------------------------------ */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("fade-in");
    }
  });
});

document.querySelectorAll("section, .composer, .share, .founder, .map, .footer")
  .forEach(el => observer.observe(el));
