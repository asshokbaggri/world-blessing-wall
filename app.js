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
