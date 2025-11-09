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

// ELEMENTS
const blessingInput = document.getElementById("blessingInput");
const countryInput  = document.getElementById("countryInput");
const sendBtn       = document.getElementById("sendBtn");
const statusBox     = document.getElementById("status");
const blessingsList = document.getElementById("blessingsList");
const counter       = document.getElementById("counter");

// ADD BLESSING
sendBtn.addEventListener("click", async () => {
  const text = blessingInput.value.trim();
  const country = countryInput.value.trim();

  if (!text) return alert("Write a blessing 😇");
  if (!country) return alert("Country batao baby 🌍");

  await addDoc(collection(db, "blessings"), {
    text,
    country,
    created: serverTimestamp(),
    approved: true
  });

  statusBox.textContent = "Blessing submitted ✅";
  blessingInput.value = "";
});

// REALTIME LISTENER
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
    div.innerHTML = `
      <b>${d.country}</b><br>
      ${d.text}<br>
      <small>${d.created?.toDate().toLocaleString()}</small>
    `;

    blessingsList.appendChild(div);
  });
});
