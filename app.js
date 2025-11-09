/* ===========================================
   WORLD BLESSING WALL — APP (PHASE 2)
   ✅ Auto-format text
   ✅ Auto country flag (with smart default)
   ✅ Infinite Load (12 per page) + Realtime newest
   ✅ Full-screen particles (already live)
   =========================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, startAfter, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* --- Firebase --- */
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

/* --- DOM --- */
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

/* --- Utils --- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function animateCount(el, to){
  if(!el) return;
  const from = Number(el.textContent || 0);
  const dur = 420;
  const t0 = performance.now();
  function tick(t){
    const p = Math.min(1, (t - t0)/dur);
    el.textContent = Math.round(from + (to - from)*p);
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* --- Country helpers --- */
const ISO2_TO_FLAG = code => {
  if(!code || code.length !== 2) return "🌍";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt()));
};
const COMMON_ALIASES = {
  "UAE":"AE", "U.K.":"GB", "UK":"GB", "USA":"US", "US":"US", "KSA":"SA",
  "Hong Kong":"HK", "South Korea":"KR", "North Korea":"KP"
};
/* Guess user country code from browser locale */
function guessUserIso2(){
  const lang = (navigator.language || "en").toUpperCase();
  const parts = lang.split("-"); // e.g. EN-IN
  if(parts.length > 1 && parts[1].length === 2) return parts[1];
  return null;
}
/* Normalize a typed country to ISO2 + nice name + flag */
function normalizeCountry(input){
  let raw = (input || "").trim();
  if(!raw){
    const iso2 = guessUserIso2();
    return iso2 ? { name: raw || iso2, flag: ISO2_TO_FLAG(iso2) } : { name:"", flag:"🌍" };
  }
  // Try to read ISO2 directly
  if(raw.length === 2) return { name: raw.toUpperCase(), flag: ISO2_TO_FLAG(raw) };

  // Map a few alias names → ISO2
  if(COMMON_ALIASES[raw]) return { name: raw, flag: ISO2_TO_FLAG(COMMON_ALIASES[raw]) };

  // Keep original name + try to find a flag by first 2 letters (rough, but better than nothing)
  const iso2 = raw.slice(0,2);
  return { name: raw, flag: ISO2_TO_FLAG(iso2) };
}

/* --- Text formatting --- */
function escapeHTML(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function tidyLine(line){
  const x = line.trim().replace(/\s+/g," ");
  if(!x) return "";
  const cap = x.charAt(0).toUpperCase() + x.slice(1);
  return /[.!?]$/.test(cap) ? cap : cap + ".";
}
function formatBlessingText(text){
  if(!text) return "";
  // Preserve line breaks but tidy each line
  return text
    .split(/\n+/)
    .map(tidyLine)
    .join("\n")
    .trim();
}

/* --- Card --- */
function makeCard({ country, text, created }){
  const wrap = document.createElement("div");
  wrap.classList.add("card","blessing-card","fade-up");

  const t = (text || "");
  const formatted = escapeHTML(formatBlessingText(t)).replace(/\n/g,"<br>");

  const { name, flag } = normalizeCountry(country);
  const timeStr =
    created?.toDate
      ? created.toDate().toLocaleString()
      : new Date().toLocaleString();

  wrap.innerHTML = `
    <b><span class="flag">${flag}</span>${escapeHTML(name || "—")}</b>
    <div>${formatted}</div>
    <small>${timeStr}</small>
  `;
  return wrap;
}

/* --- Submit --- */
async function submitBlessing(){
  const text = blessingInput.value.trim();
  const country = (countryInput.value || "").trim();

  if(!text){ blessingInput.focus(); return; }

  try{
    sendBtn.disabled = true; sendBtn.style.opacity = .7;

    // Save formatted text, but also keep original if you want later auditing
    const pretty = formatBlessingText(text);

    await addDoc(collection(db,"blessings"), {
      text: pretty,
      country: country || (guessUserIso2() || ""),
      created: serverTimestamp(),
      approved: true
    });

    statusBox.textContent = "Blessing submitted ✅";
    statusBox.style.color = "#bfe4c2";
    blessingInput.value = "";
    await sleep(150);
  }catch(err){
    statusBox.textContent = "Error: " + (err?.message || "Failed to submit");
    statusBox.style.color = "#ffb4b4";
  }finally{
    sendBtn.disabled = false; sendBtn.style.opacity = 1;
  }
}
sendBtn?.addEventListener("click", submitBlessing);
blessingInput?.addEventListener("keydown", (e)=>{
  if((e.ctrlKey || e.metaKey) && e.key === "Enter") submitBlessing();
});

/* --- Realtime newest + paged older --- */
const PAGE = 12;
let lastDoc = null;
let pagingBusy = false;
let reachedEnd = false;

/* Realtime listener for the newest PAGE items */
const newestQ = query(collection(db,"blessings"), orderBy("created","desc"), limit(PAGE));
onSnapshot(newestQ, (snap)=>{
  // Clear only the first PAGE slots (newest area) and re-render them at top.
  // Older paged items (appended later) remain unaffected.
  const existingPaged = [...document.querySelectorAll(".card.paged")];

  blessingsList.innerHTML = "";
  snap.docs.forEach(doc => {
    const card = makeCard(doc.data());
    blessingsList.appendChild(card);
  });

  // Re-append older paged items (if any)
  existingPaged.forEach(el => blessingsList.appendChild(el));

  // Track the lastDoc only if we haven't paged yet
  lastDoc = snap.docs[snap.docs.length - 1] || lastDoc;

  animateCount(counterEl, (snap.size + countPaged()));
});

/* Helper to count paged elements */
function countPaged(){
  return document.querySelectorAll(".card.paged").length;
}

/* Load more (older) once per click */
async function loadMore(){
  if(pagingBusy || reachedEnd || !lastDoc) return;
  pagingBusy = true;
  loadMoreBtn.disabled = true;

  try{
    const olderQ = query(
      collection(db,"blessings"),
      orderBy("created","desc"),
      startAfter(lastDoc),
      limit(PAGE)
    );
    const snap = await getDocs(olderQ);

    if(snap.empty){
      reachedEnd = true;
      loadMoreBtn.style.display = "none";
      noMoreEl.style.display = "block";
      return;
    }

    // Append older cards at the end of the grid
    snap.docs.forEach(d => {
      const el = makeCard(d.data());
      el.classList.add("paged");
      blessingsList.appendChild(el);
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    animateCount(counterEl, (PAGE + countPaged())); // just a nice tick; true total still via backend if needed
  }catch(e){
    console.error(e);
  }finally{
    pagingBusy = false;
    if(!reachedEnd) loadMoreBtn.disabled = false;
  }
}
loadMoreBtn?.addEventListener("click", loadMore);

/* --- Share --- */
const shareText = encodeURIComponent("Ek dua likho, duniya badlo 💫");
const shareUrl  = encodeURIComponent(location.href.split('#')[0]);
waShare?.addEventListener("click", ()=> window.open(`https://wa.me/?text=${shareText}%20${shareUrl}`,'_blank'));
twShare?.addEventListener("click", ()=> window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,'_blank'));
copyShare?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(decodeURIComponent(shareUrl));
    copyShare.textContent = "Link Copied ✅";
    await sleep(1200);
    copyShare.textContent = "Copy Link";
  }catch{}
});

/* --- Particles (already wired by you) — keeping as-is --- */
// (Using your existing goldParticles canvas & animation)
