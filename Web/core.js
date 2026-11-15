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
  S.token = ""; S.user = null; S.parents = null;
  localStorage.removeItem("token"); localStorage.removeItem("user");
  closeModal(); closeMenu();
  showAuth("login", silent ? "Session ended, please sign in again" : "");
}

/* ---------- app shell + side menu ---------- */
const M_HEAD = [["home", "🏠", "Home"], ["students", "👦", "Students"], ["people", "👥", "Parents & Teachers"], ["fees", "💰", "Fees"], ["owing", "⏰", "Who owes"], ["scores", "✏️", "Enter Scores"], ["reports", "📄", "Report Cards"], ["notices", "📢", "Notices"], ["account", "⚙️", "Account"]];
const MENU = {
  parent: [["home", "🏠", "Home"], ["reports", "📄", "Report Cards"], ["pay", "💳", "Pay Fees"], ["history", "🧾", "Payments"], ["notices", "📢", "Notices"], ["account", "⚙️", "Account"]],
  teacher: [["home", "🏠", "Home"], ["scores", "✏️", "Enter Scores"], ["students", "👦", "Students"], ["reports", "📄", "Report Cards"], ["notices", "📢", "Notices"], ["account", "⚙️", "Account"]],
  head: M_HEAD,
  owner: M_HEAD.slice(0, 8).concat([["settings", "🎨", "School Settings"]], M_HEAD.slice(8))
};
const ROLE = { owner: "School owner", head: "Head teacher", teacher: "Teacher", parent: "Parent" };

function startApp() {
  $("#auth").hidden = true; $("#app").hidden = false;
  buildMenu(); go("home");
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
function grade(t) { return t >= 80 ? ["A", "Excellent"] : t >= 70 ? ["B", "Very Good"] : t >= 60 ? ["C", "Good"] : t >= 50 ? ["D", "Credit"] : t >= 40 ? ["E", "Pass"] : ["F", "Fail"]; }
function tot(r) { return (r.subjects || []).reduce((a, s) => a + (+s.classScore || 0) + (+s.examScore || 0), 0); }
function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function reportHTML(r) {
  const sc = S.school || {}, tt = tot(r), max = (r.subjects || []).length * 100;
  const rows = (r.subjects || []).map(s => {
    const t = (+s.classScore || 0) + (+s.examScore || 0), g = grade(t);
    return `<tr><td class="l">${esc(s.name)}</td><td>${s.classScore == null ? "" : s.classScore}</td><td>${s.examScore == null ? "" : s.examScore}</td><td><b>${t}</b></td><td>${g[0]}</td><td class="l">${g[1]}</td></tr>`;
  }).join("");
  return `<div class="rc"><div class="rh"><div class="lo2">${logoHTML()}</div><div><h2>${esc(sc.invoiceName || sc.name)}</h2><p>${esc(sc.address || "")} ${esc(sc.phone || "")}</p><p><i>${esc(sc.motto || "")}</i></p></div></div>
  <div class="rbn">${r.type === "mock" ? "MOCK EXAMINATION RESULTS" : "TERMINAL REPORT CARD"} — ${esc(r.term)} ${esc(r.year)}</div>
  <div class="ri"><div><small>NAME</small><b>${esc(r.studentName)}</b></div><div><small>CLASS</small><b>${esc(r.className)}</b></div>
  <div><small>POSITION</small><b>${r.position ? ordinal(r.position) + " of " + r.outOf : "-"}</b></div><div><small>TOTAL</small><b>${tt} / ${max}</b></div></div>
  <table class="rt2"><thead><tr><th class="l">SUBJECT</th><th>CLASS (50)</th><th>EXAM (50)</th><th>TOTAL (100)</th><th>GRADE</th><th class="l">REMARK</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="nt"><b>Remark:</b> ${esc(r.remark || "")}</p>
  <div class="sg"><div>Class teacher</div><div>Head teacher</div></div>
  <p class="ky">Key: A 80-100 Excellent · B 70-79 Very Good · C 60-69 Good · D 50-59 Credit · E 40-49 Pass · F 0-39 Fail</p></div>`;
}
function showReport(r) {
  openModal(reportHTML(r) + '<div class="noprint"><button onclick="window.print()">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>');
}
function wa(phone, msg) { let d = String(phone || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "233" + d.slice(1); return "https://wa.me/" + d + "?text=" + encodeURIComponent(msg); }
 ? ["C", "Good"] : t >= 50 ? ["D", "Credit"] : t >= 40 ? ["E", "Pass"] : ["F", "Fail"]; }
function tot(r) { return (r.subjects || []).reduce((a, s) => a + (+s.classScore || 0) + (+s.examScore || 0), 0); }
function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function reportHTML(r) {
  const sc = S.school || {}, tt = tot(r), max = (r.subjects || []).length * 100;
  const rows = (r.subjects || []).map(s => {
    const t = (+s.classScore || 0) + (+s.examScore || 0), g = grade(t);
    return `<tr><td class="l">${esc(s.name)}</td><td>${s.classScore == null ? "" : s.classScore}</td><td>${s.examScore == null ? "" : s.examScore}</td><td><b>${t}</b></td><td>${g[0]}</td><td class="l">${g[1]}</td></tr>`;
  }).join("");
  return `<div class="rc"><div class="rh"><div class="lo2">${logoHTML()}</div><div><h2>${esc(sc.invoiceName || sc.name)}</h2><p>${esc(sc.address || "")} ${esc(sc.phone || "")}</p><p><i>${esc(sc.motto || "")}</i></p></div></div>
  <div class="rbn">${r.type === "mock" ? "MOCK EXAMINATION RESULTS" : "TERMINAL REPORT CARD"} — ${esc(r.term)} ${esc(r.year)}</div>
  <div class="ri"><div><small>NAME</small><b>${esc(r.studentName)}</b></div><div><small>CLASS</small><b>${esc(r.className)}</b></div>
  <div><small>POSITION</small><b>${r.position ? ordinal(r.position) + " of " + r.outOf : "-"}</b></div><div><small>TOTAL</small><b>${tt} / ${max}</b></div></div>
  <table class="rt2"><thead><tr><th class="l">SUBJECT</th><th>CLASS (50)</th><th>EXAM (50)</th><th>TOTAL (100)</th><th>GRADE</th><th class="l">REMARK</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="nt"><b>Remark:</b> ${esc(r.remark || "")}</p>
  <div class="sg"><div>Class teacher</div><div>Head teacher</div></div>
  <p class="ky">Key: A 80-100 Excellent · B 70-79 Very Good · C 60-69 Good · D 50-59 Credit · E 40-49 Pass · F 0-39 Fail</p></div>`;
}
function showReport(r) {
  openModal(reportHTML(r) + '<div class="noprint"><button onclick="window.print()">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>');
}
function wa(phone, msg) { let d = String(phone || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "233" + d.slice(1); return "https://wa.me/" + d + "?text=" + encodeURIComponent(msg); }
