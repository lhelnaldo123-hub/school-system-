/* core.js - helpers, school branding, sign in, side menu, report card */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "GHS " + (Number(n) || 0).toFixed(2);
const opts = (a, sel) => (a || []).map(x => `<option${x === sel ? " selected" : ""}>${esc(x)}</option>`).join("");
const J = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const P = {}, PP = {}, PS = {};   // P = shared pages, PP = parent pages, PS = staff pages
let S = { token: localStorage.getItem("token") || "", user: J("user", null), school: null, code: localStorage.getItem("code") || "" };

function toast(m) { const t = $("#tt"); t.textContent = m; t.style.display = "block"; clearTimeout(toast.i); toast.i = setTimeout(() => t.style.display = "none", 3200); }
function busy(on) { $("#bz").hidden = !on; }

async function api(path, method, body) {
  const o = { method: method || "GET", headers: { "Content-Type": "application/json" } };
  if (S.token) o.headers.Authorization = "Bearer " + S.token;
  if (body) o.body = JSON.stringify(body);
  let r;
  try { r = await fetch(API + path, o); } catch (e) { throw new Error("No connection. Check your internet and try again."); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { logout(true); throw new Error(j.error || "Please sign in again"); }
  if (!r.ok) throw new Error(j.error || "Server problem (code " + r.status + "). The server may be down: open your Render link in the browser to check it.");
  return j;
}

/* ---------- school look (colours, logo, name) ---------- */
function pub(s) { return { name: s.name, code: s.code, motto: s.motto, logo: s.logo, colors: s.colors, invoiceName: s.invoiceName }; }
function brand(s) {
  if (!s) return;
  S.school = Object.assign(S.school || {}, s);
  const c = s.colors || {};
  const r = document.documentElement.style;
  r.setProperty("--b", c.primary || "#0b2a8f");
  r.setProperty("--y", c.accent || "#f5b800");
  $("#tc").content = c.primary || "#0b2a8f";
  document.title = s.name || "School App";
  applyLook();
}
function logoHTML(s) {
  s = s || S.school || {};
  if (s.logo) return `<img src="${esc(s.logo)}" alt="">`;
  return `<b>${esc((s.name || "S").split(/\s+/).map(w => w[0]).join("").slice(0, 3).toUpperCase())}</b>`;
}
function splash() {
  const s = S.school;
  $("#sp").innerHTML = `<div><div class="lgo">${logoHTML()}</div><h1>${esc(s ? s.name : "School App")}</h1><div class="pill">${s ? "PORTAL" : "WELCOME"}</div><div class="ld"><i></i><i></i><i></i></div></div><div class="vis">${esc(s && s.motto || "")}</div>`;
}

/* ---------- start ---------- */
async function boot() {
  const q = new URLSearchParams(location.search);
  if (q.get("school")) { S.code = q.get("school").toLowerCase(); localStorage.setItem("code", S.code); }
  const ref = q.get("paid") || q.get("reference") || q.get("trxref");
  if (ref) localStorage.setItem("paidRef", ref);
  if (q.get("go")) localStorage.setItem("goPage", q.get("go"));
  if (q.toString()) history.replaceState(null, "", location.pathname);
  const cached = J("brand", null);
  if (cached && cached.code === S.code) brand(cached);
  splash();
  const wait = new Promise(r => setTimeout(r, 1800));
  if (S.code) {
    try { const s = await api("/school/public/" + S.code); localStorage.setItem("brand", JSON.stringify(s)); brand(s); splash(); } catch (e) { }
  }
  if (S.token) { try { brand(await api("/school/mine")); } catch (e) { } }
  await wait;
  $("#sp").classList.add("out");
  if (S.token && S.user) startApp(); else showAuth("login");
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
}

/* ---------- sign in / register ---------- */
const slug = v => v.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12);
function showAuth(mode, msg) {
  $("#app").hidden = true; $("#auth").hidden = false;
  const s = S.school;
  let form;
  if (mode === "login") form = `<h2>Sign in</h2>
    <label class="l1">School code</label><input id="a_code" value="${esc(S.code)}" placeholder="e.g. tscs" autocapitalize="none">
    <input id="a_em" placeholder="Email or phone number" autocapitalize="none">
    <div class="pwr"><input id="a_pw" type="password" placeholder="Password"><button class="tg" onclick="tgPw()">Show</button></div>
    <button class="go" onclick="doLogin()">Sign in</button><p class="er" id="a_er">${esc(msg || "")}</p>
    <p class="mu">New school? <a href="#" onclick="showAuth('reg');return false">Register your school</a></p>`;
  else form = `<h2>Register your school</h2>
    <input id="r_sn" placeholder="School name" oninput="if(!window.cd)$('#r_cd').value=slug(this.value)">
    <label class="l1">School code (staff and parents type this to sign in)</label><input id="r_cd" placeholder="e.g. tscs" autocapitalize="none" oninput="window.cd=1;this.value=slug(this.value)">
    <input id="r_on" placeholder="Owner's full name"><input id="r_em" type="email" placeholder="Owner's email" autocapitalize="none">
    <input id="r_ph" placeholder="Phone"><input id="r_pw" type="password" placeholder="Password (6+ characters)">
    <div class="r2"><div><label class="l1">Main colour</label><input id="r_p" type="color" value="#0b2a8f"></div><div><label class="l1">Accent colour</label><input id="r_a" type="color" value="#f5b800"></div></div>
    <button class="go" onclick="doRegister()">Create school</button><p class="er" id="a_er">${esc(msg || "")}</p>
    <p class="mu"><a href="#" onclick="showAuth('login');return false">← Back to sign in</a></p>`;
  $("#auth").innerHTML = `<div class="lgo sm">${logoHTML()}</div><h1>${esc(s ? s.name : "School App")}</h1><div class="pill">${mode === "login" ? "SIGN IN" : "NEW SCHOOL"}</div><div class="lb">${form}</div>`;
}
function tgPw() { const i = $("#a_pw"); i.type = i.type === "password" ? "text" : "password"; }
async function doLogin() {
  const code = $("#a_code").value.trim().toLowerCase();
  busy(true);
  try { const j = await api("/auth/login", "POST", { code, email: $("#a_em").value, password: $("#a_pw").value }); finish(j, code); }
  catch (e) { $("#a_er").textContent = e.message; }
  busy(false);
}
async function doRegister() {
  const g = id => $("#" + id).value.trim();
  busy(true);
  try {
    const j = await api("/auth/register-school", "POST", { schoolName: g("r_sn"), code: g("r_cd"), ownerName: g("r_on"), email: g("r_em"), phone: g("r_ph"), password: $("#r_pw").value, primary: $("#r_p").value, accent: $("#r_a").value });
    finish(j, j.school.code);
  } catch (e) { $("#a_er").textContent = e.message; }
  busy(false);
}
function finish(j, code) {
  S.token = j.token; S.user = j.user; S.code = code;
  localStorage.setItem("token", j.token); localStorage.setItem("user", JSON.stringify(j.user)); localStorage.setItem("code", code);
  localStorage.setItem("brand", JSON.stringify(pub(j.school)));
  S.school = null; brand(j.school);
  startApp();
}
function logout(silent) {
  S.token = ""; S.user = null; S.parents = null; clearInterval(S.nti); S.nti = null; S.nseen = null;
  localStorage.removeItem("token"); localStorage.removeItem("user");
  closeModal(); closeMenu();
  showAuth("login", silent ? "Session ended, please sign in again" : "");
}

/* ---------- app shell + side menu ---------- */
const M_HEAD = [["home", "🏠", "Home"], ["students", "👦", "Students"], ["people", "👥", "Parents & Teachers"], ["fees", "💰", "Fees"], ["owing", "⏰", "Who owes"], ["momo", "📲", "MoMo payments"], ["scores", "✏️", "Enter Scores"], ["reports", "📄", "Report Cards"], ["notices", "📢", "Notices"], ["account", "⚙️", "Account"]];
const MENU = {
  parent: [["home", "🏠", "Home"], ["reports", "📄", "Report Cards"], ["pay", "💳", "Pay Fees"], ["history", "🧾", "Payments"], ["notices", "📢", "Notices"], ["account", "⚙️", "Account"]],
  teacher: [["home", "🏠", "Home"], ["scores", "✏️", "Enter Scores"], ["students", "👦", "Students"], ["reports", "📄", "Report Cards"], ["notices", "📢", "Notices"], ["account", "⚙️", "Account"]],
  head: M_HEAD,
  owner: M_HEAD.slice(0, 9).concat([["settings", "🎨", "School Settings"]], M_HEAD.slice(9))
};
const ROLE = { owner: "School owner", head: "Head teacher", teacher: "Teacher", parent: "Parent" };

function startApp() {
  $("#auth").hidden = true; $("#app").hidden = false;
  buildMenu(); go("home");
  api("/school/mine").then(x => { brand(x); }).catch(() => { });
  startNotes();
  const gp = localStorage.getItem("goPage"); if (gp) { localStorage.removeItem("goPage"); if (MENU[S.user.role].some(i => i[0] === gp)) go(gp); }
  const ref = localStorage.getItem("paidRef");
  if (ref) { localStorage.removeItem("paidRef"); if (S.user.role === "parent") verifyPaid(ref); }
}
function buildMenu() {
  const s = S.school || {};
  $("#hl").innerHTML = logoHTML();
  $("#side").innerHTML = `<div class="mh"><div class="lo">${logoHTML()}</div><div><b>${esc(s.name)}</b><small>${ROLE[S.user.role]} · ${esc(S.user.name)}</small></div></div>`
    + MENU[S.user.role].map(i => `<button class="mi" data-p="${i[0]}" onclick="go('${i[0]}')"><span>${i[1]}</span>${i[2]}</button>`).join("")
    + `<button class="mi" onclick="logout()"><span>🚪</span>Sign out</button>`;
}
function openMenu() { $("#side").classList.add("open"); $("#ov").hidden = false; }
function closeMenu() { $("#side").classList.remove("open"); $("#ov").hidden = true; }
function go(p) {
  S.page = p; closeMenu();
  document.querySelectorAll(".mi").forEach(b => b.classList.toggle("on", b.dataset.p === p));
  const it = MENU[S.user.role].find(i => i[0] === p);
  $("#pt").textContent = it ? it[2] : "";
  load();
}
async function load() {
  const m = $("#main");
  m.innerHTML = '<p class="mu">Loading…</p>';
  const f = (S.user.role === "parent" ? PP : PS)[S.page] || P[S.page];
  try { await f(m); }
  catch (e) { m.innerHTML = `<div class="c"><div class="g1">⚠️ ${esc(e.message)}</div><button class="sm" onclick="go(S.page)">Retry</button></div>`; }
  window.scrollTo(0, 0);
}
function openModal(h) { const m = $("#modal"); m.innerHTML = `<div class="mc">${h}</div>`; m.hidden = false; m.scrollTop = 0; }
function closeModal() { $("#modal").hidden = true; }

/* ---------- report card (used by parents and staff) ---------- */
/* Colour templates come from the old TSCS SBA system. The owner picks one in School Settings. */
const THEMES = { y: "Gold & Blue", b: "Royal Blue", p: "Pink", c: "Classic", g: "Green", v: "Violet", o: "Orange", s: "School colours" };
const tplOn = () => !!((S.school || {}).reportTpl && S.school.reportTpl.img);
const themeList = () => tplOn() ? Object.assign({}, THEMES, { u: "My own template" }) : THEMES;
const themeOf = t => { const L = themeList(); return L[t] ? t : (L[(S.school || {}).reportTheme] ? S.school.reportTheme : "y"); };

/* ---------- handwriting + own template ---------- */
const INKS = { "Caveat": 17, "Dancing Script": 16, "Patrick Hand": 15, "Shadows Into Light": 16, "Indie Flower": 14, "Homemade Apple": 12, "Nanum Pen Script": 18, "Printed (no handwriting)": 13 };
const INKCOL = { "": "School colour", "#0b2a8f": "Blue ink", "#111111": "Black ink", "#8b0000": "Dark red ink", "#0a5a2e": "Green ink", "#4a1d9a": "Purple ink" };
function inkNow() { const o = J("sbInk", {}), s = (S.school || {}).ink || {}; return { font: o.font || s.font || "Caveat", color: o.color != null ? o.color : (s.color || "") }; }
function applyLook() {
  const r = document.documentElement, k = inkNow(), size = INKS[k.font] || 17, print = k.font.startsWith("Printed");
  r.style.setProperty("--inkf", print ? "system-ui,sans-serif" : `'${k.font}','Segoe Script','Comic Sans MS',cursive`);
  r.style.setProperty("--inks", size + "px");
  if (k.color) r.style.setProperty("--inkc", k.color); else r.style.removeProperty("--inkc");
  const t = (S.school || {}).reportTpl || {};
  if (t.img) { r.style.setProperty("--tplimg", `url("${t.img}")`); r.style.setProperty("--tpltop", (t.top == null ? 40 : t.top) + "mm"); r.style.setProperty("--tplside", (t.side == null ? 10 : t.side) + "mm"); }
  else { r.style.removeProperty("--tplimg"); r.style.removeProperty("--tpltop"); r.style.removeProperty("--tplside"); }
  r.dataset.tplhd = t.hideHead === false ? "1" : "0";
  if (!print && document.fonts && document.fonts.load) document.fonts.load(`700 16px "${k.font}"`).then(() => shFit(document)).catch(() => { });
  shFit(document);
}
function setInk(key, v) { const o = J("sbInk", {}); o[key] = v; localStorage.setItem("sbInk", JSON.stringify(o)); applyLook(); }
const inkSel = () => { const k = inkNow(); return `<select onchange="setInk('font',this.value)">${Object.keys(INKS).map(f => `<option${f === k.font ? " selected" : ""}>${f}</option>`).join("")}</select><select onchange="setInk('color',this.value)">${Object.keys(INKCOL).map(c => `<option value="${c}"${c === k.color ? " selected" : ""}>${INKCOL[c]}</option>`).join("")}</select>`; };

/* ---------- A4 sheet: the card is 748 x 1073 px (= 198 x 284 mm) ---------- */
const SW = 748, SH = 1073;
function fitCard(c) {
  const cells = c.querySelectorAll(".x-tbl td,.x-tbl th"), set = p => cells.forEach(x => { x.style.paddingTop = x.style.paddingBottom = p + "px"; });
  let p = 13; set(p);
  while (p > 1 && c.scrollHeight > c.clientHeight + 1) { p--; set(p); }
}
function shFit(root) {
  (root || document).querySelectorAll(".rc2").forEach(c => {
    fitCard(c); const bx = c.parentElement; if (!bx || !bx.classList.contains("sheetbox")) return;
    const k = Math.min(1, bx.clientWidth / SW || 1); c.style.transformOrigin = "0 0"; c.style.transform = k < 1 ? `scale(${k})` : "none"; bx.style.height = Math.round(SH * k) + "px";
  });
}
addEventListener("resize", () => shFit(document));
function filterList(sel, q) { q = q.trim().toLowerCase(); document.querySelectorAll(sel + " > .c").forEach(c => { c.hidden = !!q && !c.textContent.toLowerCase().includes(q); }); }
function imgShrink(file, maxW, q, type) {
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onerror = no;
    fr.onload = () => { const img = new Image(); img.onerror = no; img.onload = () => {
      const k = Math.min(1, maxW / img.width), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL(type || "image/jpeg", q || .75)); }; img.src = fr.result; };
    fr.readAsDataURL(file);
  });
}
function grade(t) { return t >= 80 ? ["A", "Excellent"] : t >= 70 ? ["B", "Very Good"] : t >= 60 ? ["C", "Good"] : t >= 50 ? ["D", "Credit"] : t >= 40 ? ["E", "Pass"] : ["F", "Fail"]; }
function tot(r) { return (r.subjects || []).reduce((a, s) => a + (+s.classScore || 0) + (+s.examScore || 0), 0); }
function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function reportHTML(r, theme) {
  const sc = S.school || {}, th = themeOf(theme);
  const subs = r.subjects || [], tt = tot(r), max = subs.length * 100;
  const avg = subs.length ? Math.round(tt / subs.length * 10) / 10 : 0;
  const og = subs.length ? grade(avg) : ["-", ""];
  const rows = subs.map(s => {
    const t = (+s.classScore || 0) + (+s.examScore || 0), g = grade(t);
    return `<tr><td class="sj">${esc(s.name)}</td><td class="ink">${s.classScore == null ? "" : s.classScore}</td><td class="ink">${s.examScore == null ? "" : s.examScore}</td><td class="ink">${t}</td><td><b>${g[0]}</b></td><td class="l">${g[1]}</td></tr>`;
  }).join("");
  const key = [["80 - 100", "A", "Excellent"], ["70 - 79", "B", "Very Good"], ["60 - 69", "C", "Good"], ["50 - 59", "D", "Credit"], ["40 - 49", "E", "Pass"], ["0 - 39", "F", "Fail"]]
    .map(k => `<tr><td>${k[0]}</td><td>${k[1]}</td><td class="l">${k[2]}</td></tr>`).join("");
  const addr = [sc.address, sc.phone].filter(Boolean).map(esc).join(" · ");
  const pos = r.position ? ordinal(r.position) + " of " + r.outOf : "-";
  const initial = esc((r.studentName || "?").trim().charAt(0).toUpperCase());
  return `<div class="rc2 th-${th}">
    ${r.type === "mock" ? '<div class="x-stamp"><b>MOCK</b>EXAM</div>' : ""}
    <div class="x-head"><div class="x-logo">${logoHTML()}</div><div class="x-hm"><h2>${esc(sc.invoiceName || sc.name)}</h2>${addr ? `<p>${addr}</p>` : ""}${sc.motto ? `<p class="x-mt">${esc(sc.motto)}</p>` : ""}</div></div>
    <div class="x-ban">${r.type === "mock" ? "MOCK EXAMINATION RESULTS" : "END OF TERM REPORT"}</div>
    <div class="x-info"><div class="x-grid">
      <div><small>Name</small><b class="ink">${esc(r.studentName)}</b></div><div><small>Class</small><b class="ink">${esc(r.className)}</b></div>
      <div><small>Term</small><b class="ink">${esc(r.term)}</b></div><div><small>Year</small><b class="ink">${esc(r.year)}</b></div></div>
      <div class="x-photo">${r.photo ? `<img src="${esc(r.photo)}" alt="">` : initial}</div></div>
    <table class="x-tbl"><thead><tr><th class="l">SUBJECT</th><th>CLASS (50)</th><th>EXAM (50)</th><th>TOTAL (100)</th><th>GRADE</th><th class="l">REMARK</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="x-sum"><div><small>Total score</small><b>${tt} / ${max}</b></div><div><small>Average</small><b>${avg}</b></div><div><small>Position</small><b>${pos}</b></div><div><small>Overall grade</small><b>${og[0]}${og[1] ? " · " + og[1] : ""}</b></div></div>
    <div class="x-cg"><div><div class="x-lb">Class teacher's remark</div><div class="x-ln ink">${esc(r.remark || "")}</div><div class="x-ln"></div>
      <div class="x-lb">Head teacher's remark</div><div class="x-ln"></div><div class="x-ln"></div></div>
      <div><table class="x-gt"><thead><tr><th>MARKS</th><th>GRADE</th><th class="l">REMARK</th></tr></thead><tbody>${key}</tbody></table></div></div>
    <div class="x-sign"><div>Class teacher</div><div>Head teacher</div></div>
  </div>`;
}
function showReport(r, theme) {
  window.RP = r;
  const cur = themeOf(theme);
  const pick = S.user.role === "parent" ? "" : `<select onchange="showReport(RP,this.value)" style="width:auto">${Object.keys(themeList()).map(k => `<option value="${k}"${k === cur ? " selected" : ""}>${themeList()[k]}</option>`).join("")}</select>${inkSel()}`;
  openModal(`<div class="sheetbox">${reportHTML(r, cur)}</div>` + `<div class="noprint">${pick}<button onclick="window.print()">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>`); shFit($("#modal"));
}
function showReports(list) {
  openModal(list.map(r => `<div class="pgc sheetbox">${reportHTML(r)}</div>`).join("") + '<div class="noprint"><button onclick="window.print()">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>'); shFit($("#modal"));
}
function wa(phone, msg) { let d = String(phone || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "233" + d.slice(1); return "https://wa.me/" + d + "?text=" + encodeURIComponent(msg); }


/* ---------- notifications (bell, badge, phone alerts) ---------- */
function startNotes() {
  clearInterval(S.nti); S.nseen = null; checkNotes();
  S.nti = setInterval(() => { if (S.token && !document.hidden) checkNotes(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.token) checkNotes(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.page && S.user) go(e.data.page); });
}
async function checkNotes() {
  try {
    const d = await api("/notifications"); S.notes = d;
    const bn = $("#bn"); bn.hidden = !d.unread; bn.textContent = d.unread > 99 ? "99+" : d.unread;
    const fresh = d.list.filter(n => !n.read && (!S.nseen || new Date(n.createdAt) > S.nseen));
    if (S.nseen && fresh.length) {
      toast("🔔 " + fresh[0].title + (fresh.length > 1 ? " (+" + (fresh.length - 1) + " more)" : ""));
      if (S.page === "momo" || S.page === "pay") load();
    }
    if (d.list.length) S.nseen = new Date(d.list[0].createdAt);
    else if (!S.nseen) S.nseen = new Date();
  } catch (e) { }
}
async function showNotes() {
  await checkNotes();
  const d = S.notes || { list: [], unread: 0 };
  const canPush = "serviceWorker" in navigator && "PushManager" in window && d.push;
  openModal(`<h3>🔔 Notifications</h3>` + (d.list.length ? d.list.map(n => `<button class="nt${n.read ? "" : " un"}" onclick="openNote('${n._id}','${esc(n.page)}')"><b>${esc(n.title)}</b>${esc(n.body)}<br><small>${new Date(n.createdAt).toLocaleString()}</small></button>`).join("") : '<p class="mu">No notifications yet.</p>')
    + `<div class="noprint">${canPush ? '<button class="y" onclick="enablePush()">📳 Get alerts on this phone even when the app is closed</button>' : ""}${d.unread ? '<button class="g" onclick="readAllNotes()">Mark all as read</button>' : ""}<button class="g" onclick="closeModal()">Close</button></div>`);
}
async function openNote(id, page) {
  try { await api("/notifications/read", "POST", { id }); } catch (e) { }
  closeModal(); checkNotes();
  if (MENU[S.user.role].some(i => i[0] === page)) go(page);
}
async function readAllNotes() { try { await api("/notifications/read", "POST", {}); } catch (e) { } closeModal(); checkNotes(); }
async function enablePush() {
  try {
    if (Notification.permission === "denied") return toast("Alerts are blocked in your browser settings for this site");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return toast("Alerts were not allowed");
    const reg = await navigator.serviceWorker.ready, k = (await api("/notifications/key")).key;
    if (!k) return toast("Phone alerts are not set up on the server yet");
    const b = k.replace(/-/g, "+").replace(/_/g, "/"), raw = atob(b + "=".repeat((4 - b.length % 4) % 4));
    const key = Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await api("/notifications/subscribe", "POST", { sub: sub.toJSON() });
    toast("Phone alerts are on ✅"); closeModal();
  } catch (e) { toast("Could not turn on alerts: " + e.message); }
}