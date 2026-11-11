import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIg-OXBSMExX6Zt1GvqLxkpKODA6GWngY",
  authDomain: "lensshift-1251e.firebaseapp.com",
  projectId: "lensshift-1251e",
  storageBucket: "lensshift-1251e.firebasestorage.app",
  messagingSenderId: "722868375633",
  appId: "1:722868375633:web:29b5607580d9f603d5e870",
  measurementId: "G-5EPL914B25"
};

const fbApp = initializeApp(firebaseConfig);

const LENSES = [
  { id: "white", name: "עובדות", lens: "העדשה הלבנה", color: "var(--white)", sub: "מה אנחנו יודעים בוודאות? מה חסר לנו?",
    prompts: ["מהן העובדות?", "איזה מידע חסר לי?", "מה המספרים אומרים?", "מה אני מניח/ה בלי שבדקתי?"] },
  { id: "red", name: "רגש", lens: "העדשה האדומה", color: "var(--red)", sub: "מה אני מרגיש/ה? מה האינטואיציה אומרת – בלי להצדיק?",
    prompts: ["מה הבטן אומרת?", "מה מלחיץ אותי?", "מה מלהיב אותי?", "איך אחרים מרגישים סביב זה?"] },
  { id: "black", name: "זהירות", lens: "העדשה השחורה", color: "var(--black)", sub: "מה יכול להשתבש? איפה הסיכונים?",
    prompts: ["מה הבעיה כאן?", "מהם הקשיים או הסיכונים?", "מה אולי מתפספס?", "מה עלולות להיות ההשלכות?"] },
  { id: "yellow", name: "תועלת", lens: "העדשה הצהובה", color: "var(--yellow)", sub: "מה הערך? מה יצא מזה טוב?",
    prompts: ["מה הערך או הפוטנציאל?", "מה טוב ועובד?", "על אילו חוזקות או משאבים אפשר להישען?", "מה התרחיש הטוב ביותר?"] },
  { id: "green", name: "יצירתיות", lens: "העדשה הירוקה", color: "var(--green)", sub: "אילו רעיונות ואפשרויות חדשות יש? בלי לשפוט.",
    prompts: ["אילו פתרונות יצירתיים יכולים להיות?", "אילו עוד אפשרויות יש?", "מה אם היינו הופכים את זה?", "מה הרעיון המטורף ביותר?"] },
  { id: "blue", name: "תהליך", lens: "העדשה הכחולה", color: "var(--blue)", sub: "איפה אנחנו? מה הצעד הבא? מה ההחלטה?",
    prompts: ["מה המטרה המרכזית?", "מה למדנו מהעדשות האחרות?", "מה הכי חשוב עכשיו?", "מה הצעד הבא?"] }
];

const $app = document.getElementById("app");
const $sync = document.getElementById("syncState");
const LS_KEY = "lensshift.challenges.v1";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- storage: localStorage always, Firestore when available ----------
let challenges = [];
let cloud = null; // { db, uid }

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(challenges)); } catch {}
}
function setSync(text) { $sync.textContent = text; }

async function initCloud() {
  try {
    const cred = await signInAnonymously(getAuth(fbApp));
    cloud = { db: getFirestore(fbApp), uid: cred.user.uid };
    const snap = await getDocs(collection(cloud.db, "users", cloud.uid, "challenges"));
    const remote = snap.docs.map(d => d.data());
    const byId = new Map(challenges.map(c => [c.id, c]));
    remote.forEach(r => { const l = byId.get(r.id); if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) byId.set(r.id, r); });
    challenges = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    saveLocal();
    for (const c of challenges) await pushCloud(c);
    setSync("☁ נשמר בענן");
    if (!state.current) render();
  } catch (e) {
    console.warn("Cloud sync unavailable:", e);
    setSync("נשמר במכשיר בלבד");
  }
}
async function pushCloud(c) {
  if (!cloud) return;
  try { await setDoc(doc(cloud.db, "users", cloud.uid, "challenges", c.id), c); setSync("☁ נשמר בענן"); }
  catch (e) { console.warn(e); setSync("נשמר במכשיר בלבד"); }
}
let timer;
function persist(c) {
  c.updatedAt = Date.now();
  saveLocal();
  clearTimeout(timer);
  timer = setTimeout(() => pushCloud(c), 500);
}

// ---------- state & routing ----------
const state = { current: null, lens: "white" };

function render() { state.current ? renderWorkspace() : renderHome(); }

function progressDots(c) {
  return `<span class="progress">${LENSES.map(l => `<i class="${c.lenses[l.id]?.length ? "on" : ""}" style="--c:${l.color}"></i>`).join("")}</span>`;
}

function renderHome() {
  $app.innerHTML = `
    <h1>להחליף עדשה, לראות אחרת</h1>
    <p class="lead"><b>אותו אתגר, שש דרכים להסתכל עליו.</b><br>כתבו אתגר, והתבוננו בו דרך שש עדשות – עובדות, רגש, זהירות, תועלת, יצירתיות ותהליך –<br>בהשראת שיטת "ששת כובעי החשיבה" של אדוארד דה בונו.</p>
    <form class="card" id="newForm">
      <label for="title">מה האתגר?</label>
      <input type="text" id="title" required maxlength="140" placeholder="למשל: האם לעבור לעבודה חדשה?">
      <label for="desc">קצת הקשר (לא חובה)</label>
      <textarea id="desc" placeholder="רקע, מגבלות, מה חשוב לך…"></textarea>
      <div class="row"><button class="btn" type="submit">התחילו לחקור</button></div>
    </form>
    ${challenges.length ? `<div class="list" aria-label="אתגרים קודמים">
      ${challenges.map(c => `<button class="card item" data-id="${c.id}"><span><b>${esc(c.title)}</b><br><small>${new Date(c.updatedAt).toLocaleDateString("he-IL")}</small></span>${progressDots(c)}</button>`).join("")}
    </div>` : ""}`;
  document.getElementById("newForm").onsubmit = e => {
    e.preventDefault();
    const c = { id: uid(), title: title.value.trim(), description: desc.value.trim(), lenses: {}, decision: "", updatedAt: Date.now() };
    challenges.unshift(c); persist(c);
    open(c.id);
  };
  $app.querySelectorAll(".item").forEach(b => b.onclick = () => open(b.dataset.id));
}

function open(id) {
  state.current = challenges.find(c => c.id === id);
  state.lens = "white";
  renderWorkspace();
  window.scrollTo(0, 0);
}

function renderWorkspace() {
  const c = state.current;
  const lens = LENSES.find(l => l.id === state.lens) || LENSES[0];
  const notes = c.lenses[lens.id] || [];
  $app.innerHTML = `
    <button class="back no-print" type="button" id="backBtn">→ לכל האתגרים</button>
    <div class="challenge-bar">האתגר: <b>${esc(c.title)}</b>${c.description ? ` · ${esc(c.description)}` : ""}</div>
    <div class="tabs" role="tablist">
      ${LENSES.map(l => `<button class="tab" role="tab" aria-selected="${l.id === state.lens}" data-lens="${l.id}" style="--c:${l.color}">
        <span class="sw"></span>${l.name}<span class="n">${(c.lenses[l.id] || []).length || ""}</span></button>`).join("")}
      <button class="tab" role="tab" aria-selected="${state.lens === "summary"}" data-lens="summary" style="--c:var(--ink)" ><span class="sw" style="background:conic-gradient(var(--white),var(--red),var(--black),var(--yellow),var(--green),var(--blue),var(--white))"></span>סיכום</button>
    </div>
    ${state.lens === "summary" ? summaryHtml(c) : `
    <section class="card lens" data-lens="${lens.id}" style="--c:${lens.color}">
      <h2>${lens.name} <small style="font-weight:400;color:var(--soft)">· ${lens.lens}</small></h2>
      <p class="sub">${lens.sub}</p>
      <div class="prompts">${lens.prompts.map(p => `<button class="chip" type="button">${esc(p)}</button>`).join("")}</div>
      <form id="noteForm">
        <textarea id="note" placeholder="כתבו מחשבה ולחצו Enter להוספה…" aria-label="מחשבה חדשה"></textarea>
        <div class="row"><button class="btn" type="submit">הוסיפו</button></div>
      </form>
      <ul class="notes">${notes.map((n, i) => `<li><span>${esc(n)}</span><button data-del="${i}" aria-label="מחיקה">×</button></li>`).join("")}</ul>
    </section>`}
    <div class="row no-print"><button class="btn ghost" id="delBtn">מחיקת האתגר</button></div>`;

  document.getElementById("backBtn").onclick = () => { state.current = null; render(); window.scrollTo(0, 0); };
  $app.querySelectorAll(".tab").forEach(t => t.onclick = () => { state.lens = t.dataset.lens; renderWorkspace(); });
  document.getElementById("delBtn").onclick = async () => {
    if (!confirm("למחוק את האתגר לצמיתות?")) return;
    challenges = challenges.filter(x => x.id !== c.id); saveLocal();
    if (cloud) try { await deleteDoc(doc(cloud.db, "users", cloud.uid, "challenges", c.id)); } catch {}
    state.current = null; render();
  };
  if (state.lens === "summary") {
    $app.querySelectorAll("[data-close]").forEach(t => t.oninput = () => {
      c.closing = closingOf(c);
      c.closing[t.dataset.close] = t.value; persist(c);
    });
    $app.querySelectorAll("[data-star]").forEach(b => b.onclick = () => {
      const id = b.dataset.star, text = c.lenses[id][+b.dataset.i];
      const stars = ((c.stars ||= {})[id] ||= []);
      const at = stars.indexOf(text);
      at >= 0 ? stars.splice(at, 1) : stars.push(text);
      persist(c); renderWorkspace();
    });
    document.getElementById("printBtn").onclick = () => print();
    return;
  }
  const note = document.getElementById("note");
  const add = () => {
    const v = note.value.trim(); if (!v) return;
    (c.lenses[lens.id] ||= []).push(v); persist(c); renderWorkspace();
    document.getElementById("note").focus();
  };
  document.getElementById("noteForm").onsubmit = e => { e.preventDefault(); add(); };
  note.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } };
  $app.querySelectorAll(".chip").forEach(ch => ch.onclick = () => { note.placeholder = ch.textContent; note.focus(); });
  $app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const [gone] = c.lenses[lens.id].splice(+b.dataset.del, 1);
    const stars = c.stars?.[lens.id];
    const at = stars && !c.lenses[lens.id].includes(gone) ? stars.indexOf(gone) : -1;
    if (at >= 0) stars.splice(at, 1);
    persist(c); renderWorkspace();
  });
}

const CLOSING = [["understand", "מה אני מבין/ה עכשיו יותר?"], ["remember", "מה הכי חשוב לי לזכור?"], ["next", "מה הצעד הבא?"]];
// Older challenges kept a single "decision" field; it carries over as the next step
const closingOf = c => c.closing || (c.decision ? { next: c.decision } : {});
const isStarred = (c, lensId, text) => (c.stars?.[lensId] || []).includes(text);

function summaryHtml(c) {
  const dot = l => `<i${l.id === "white" ? " data-white" : ""}></i>`;
  const starred = LENSES.flatMap(l => (c.lenses[l.id] || []).filter(x => isStarred(c, l.id, x)).map(x => ({ l, x })));
  const highlights = `<div class="highlights"><h3>⭐ מה בלט</h3>${starred.length
    ? `<ul class="hl">${starred.map(({ l, x }) => `<li style="--c:${l.color}">${dot(l)}<span>${esc(x)}</span></li>`).join("")}</ul>`
    : `<small>סמנו 2–4 מחשבות שהפתיעו, נגעו או שינו לכם את התמונה.</small>`}</div>`;
  const body = LENSES.map(l => {
    const n = c.lenses[l.id] || [];
    return `<h3 style="--c:${l.color}">${dot(l)}${l.name}</h3>${n.length ? `<ul class="snotes">${n.map((x, i) => {
      const on = isStarred(c, l.id, x);
      return `<li><button class="star${on ? " on" : ""}" type="button" data-star="${l.id}" data-i="${i}" aria-pressed="${on}" aria-label="סימון בכוכב">${on ? "★" : ""}</button><span>${esc(x)}</span></li>`;
    }).join("")}</ul>` : `<small style="color:var(--soft)">עוד לא נחקר</small>`}`;
  }).join("");
  const closing = closingOf(c);
  return `<section class="card summary"><h2 style="margin:0">הסיכום שלי</h2>${highlights}${body}
    <div class="closing"><h3>לסיום</h3>
      ${CLOSING.map(([k, q]) => `<label for="close-${k}">${q}</label><textarea id="close-${k}" data-close="${k}">${esc(closing[k] || "")}</textarea>`).join("")}
    </div>
    <div class="row no-print"><button class="btn" id="printBtn">הדפסה / PDF</button></div></section>`;
}

document.getElementById("homeBtn").onclick = () => { state.current = null; render(); };
challenges = loadLocal();
setSync("נשמר במכשיר");
render();
initCloud();

