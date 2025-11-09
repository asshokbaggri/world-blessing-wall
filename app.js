// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy
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

// ===== ELEMENTS =====
const blessingInput = document.getElementById("blessingInput");
const countryInput  = document.getElementById("countryInput");
const sendBtn       = document.getElementById("sendBtn");
const statusBox     = document.getElementById("status");
const counterEl     = document.getElementById("counter");
const listEl        = document.getElementById("blessingsList");

const waBtn   = document.getElementById("waShare");
const twBtn   = document.getElementById("twShare");
const cpBtn   = document.getElementById("copyShare");

// ===== UTIL =====
const flag = (country="")=>{
  const C = country.trim().toLowerCase();
  const map = {
    "india":"🇮🇳","united states":"🇺🇸","usa":"🇺🇸","uk":"🇬🇧","united kingdom":"🇬🇧",
    "uae":"🇦🇪","canada":"🇨🇦","australia":"🇦🇺","nepal":"🇳🇵","pakistan":"🇵🇰",
    "bangladesh":"🇧🇩","sri lanka":"🇱🇰","indonesia":"🇮🇩","germany":"🇩🇪","france":"🇫🇷",
    "spain":"🇪🇸","italy":"🇮🇹","japan":"🇯🇵","china":"🇨🇳","brazil":"🇧🇷","mexico":"🇲🇽",
  };
  return map[C] || "🌍";
};

// ===== ADD BLESSING =====
sendBtn.addEventListener("click", async () => {
  const text = blessingInput.value.trim();
  const country = countryInput.value.trim();

  if (!text){ alert("Write a blessing first 😇"); return; }
  if (!country){ alert("Country bhi likho baby 🌍"); return; }

  await addDoc(collection(db,"blessings"),{
    text, country, created: serverTimestamp(), approved:true
  });

  statusBox.textContent = "Blessing submitted ✅";
  blessingInput.value = "";
  setTimeout(()=> statusBox.textContent = "", 1800);
});

// ===== LIVE FEED (Realtime) =====
const q = query(collection(db,"blessings"), orderBy("created","desc"));
onSnapshot(q, (snap)=>{
  listEl.innerHTML = "";
  const total = snap.docs.length;
  // count-up animation
  const current = Number(counterEl.textContent || 0);
  if (total !== current){
    let i = current;
    const t = setInterval(()=>{
      i += (total>current ? 1 : -1);
      counterEl.textContent = i;
      if (i === total) clearInterval(t);
    }, 20);
  }

  snap.forEach(doc=>{
    const d = doc.data();
    const card = document.createElement("div");
    card.className = "card";
    const when = d.created?.toDate ? d.created.toDate().toLocaleString() : "";
    card.innerHTML = `
      <div><span class="flag">${flag(d.country)}</span><b>${d.country || "World"}</b></div>
      <div style="margin:6px 0 10px">${(d.text||"").replace(/\n/g,"<br>")}</div>
      <small>${when}</small>
    `;
    listEl.appendChild(card);
  });
});

// ===== SHARE =====
const pageUrl = location.href.split("#")[0];
waBtn?.addEventListener("click", ()=> {
  const text = encodeURIComponent("Write a blessing ✨ " + pageUrl);
  window.open(`https://wa.me/?text=${text}`, "_blank");
});
twBtn?.addEventListener("click", ()=> {
  const text = encodeURIComponent("Ek Dua Likho, Duniya Badlo 💫 #WorldBlessingWall " + pageUrl);
  window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
});
cpBtn?.addEventListener("click", async ()=>{
  try{ await navigator.clipboard.writeText(pageUrl);
       cpBtn.textContent="Copied ✅"; setTimeout(()=>cpBtn.textContent="Copy Link",1200);
  }catch{ alert("Copy failed"); }
});

// ===== SMOOTH SCROLL + ACTIVE MENU =====
document.querySelectorAll('.menu a').forEach(a=>{
  a.addEventListener('click', (e)=>{
    const id = a.getAttribute('href');
    if(id?.startsWith('#')){
      e.preventDefault();
      document.querySelector(id)?.scrollIntoView({behavior:'smooth', block:'start'});
    }
  });
});
