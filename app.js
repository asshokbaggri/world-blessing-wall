// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot
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

// DOM
const blessingText  = document.getElementById("blessingText");
const countryInput  = document.getElementById("countryInput");
const blessingsList = document.getElementById("blessingsList");
const statusEl      = document.getElementById("status");
const sendBtn       = document.getElementById("sendBtn");

// Submit
async function submitBlessing(){
  const text = (blessingText.value || "").trim();
  const country = (countryInput.value || "").trim() || "Unknown";
  if(!text){ statusEl.textContent = "Please write something 🙏"; return; }

  sendBtn.disabled = true;
  statusEl.textContent = "Sending…";

  try{
    await addDoc(collection(db,"blessings"), {
      text, country, created: serverTimestamp(), approved: true
    });
    blessingText.value = "";
    statusEl.textContent = "Blessing submitted ✅";
  }catch(err){
    console.error(err);
    statusEl.textContent = "Couldn’t submit (check rules/console).";
  }finally{
    sendBtn.disabled = false;
  }
}
sendBtn.addEventListener("click", submitBlessing);

// Live feed
const q = query(collection(db,"blessings"), orderBy("created","desc"));
onSnapshot(q, (snap)=>{
  blessingsList.innerHTML = "";
  snap.forEach(doc=>{
    const d = doc.data();
    const when = d.created ? new Date(d.created.toDate()).toLocaleString() : "just now";
    const card = document.createElement("div");
    card.className = "blessing";
    card.innerHTML = `<b>${d.country || "Unknown"}</b><br>${d.text}<br><br><small>${when}</small>`;
    blessingsList.appendChild(card);
  });
}, (err)=>{
  console.error(err);
  statusEl.textContent = "Live feed error (check console).";
});

// Share helpers (basic)
const shareWhatsApp = document.getElementById("shareWhatsApp");
const shareX        = document.getElementById("shareX");
const copyLink      = document.getElementById("copyLink");
const siteURL       = location.href.split('#')[0];

if(shareWhatsApp){
  shareWhatsApp.href = `https://wa.me/?text=${encodeURIComponent("Bless the world with me 💫 " + siteURL)}`;
}
if(shareX){
  shareX.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent("Ek Dua Likho, Duniya Badlo 💫")}&url=${encodeURIComponent(siteURL)}`;
}
if(copyLink){
  copyLink.addEventListener("click", async ()=>{
    await navigator.clipboard.writeText(siteURL);
    statusEl.textContent = "Link copied ✨";
  });
}
