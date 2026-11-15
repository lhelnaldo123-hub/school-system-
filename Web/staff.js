/* staff.js - pages for teachers, head teachers and the school owner */
const staffHead = () => ["owner", "head"].includes(S.user.role);
const tClasses = () => (S.user.role === "teacher" && S.user.classes && S.user.classes.length) ? S.user.classes : S.school.classes;
const lines = sel => $(sel).value.split("\n").map(x => x.trim()).filter(Boolean);
async function parentsList() { if (!S.parents) S.parents = await api("/auth/users?role=parent"); return S.parents; }
const parOpts = sel => '<option value="">— none —</option>' + (S.parents || []).map(p => `<option value="${p._id}"${p._id === sel ? " selected" : ""}>${esc(p.name)} (${esc(p.phone || "no phone")})</option>`).join("");

/* ---------- home ---------- */
PS.home = async m => {
  if (S.user.role === "teacher") {
    m.innerHTML = `<h2>Hello, ${esc(S.user.name)}</h2><div class="c"><div class="g1"><b>Your classes</b><div class="mu">${esc((S.user.classes || []).join(", ") || "All classes")}</div></div></div>
      <div class="r2"><button class="y" onclick="go('scores')">✏️ Enter scores</button><button onclick="go('students')">👦 Students</button></div>`;
    return;
  }
  const [st, ow] = await Promise.all([api("/students"), api("/fees/owing")]);
  const owed = ow.reduce((a, x) => a + x.owed, 0);
  m.innerHTML = `<h2>${esc(S.school.name)}</h2><div class="st"><div><b>${st.length}</b><small>Students</small></div><div><b>${ow.length}</b><small>Owing fees</small></div><div><b>${money(owed)}</b><small>Total owed</small></div></div>
    <div class="r2"><button onclick="go('students')">👦 Students</button><button onclick="go('fees')">💰 Fees</button></div>
    <div class="r2"><button class="y" onclick="go('owing')">⏰ Who owes</button><button onclick="go('reports')">📄 Report cards</button></div>
    ${S.user.role === "owner" ? '<button class="g" onclick="go(\'settings\')">🎨 School settings and fee reminders</button>' : ""}`;
};

/* ---------- students ---------- */
PS.students = async m => {
  const cl = tClasses();
  const cur = S.cls && cl.includes(S.cls) ? S.cls : cl[0];
  S.cls = cur;
  const list = await api("/students?className=" + encodeURIComponent(cur));
  if (staffHead()) await parentsList();
  window.SL = list;
  const sh = staffHead();
  const rows = list.length ? list.map((s, i) => `<div class="c"><div class="g1"><b>${esc(s.name)}</b><div class="mu">${s.parents.map(p => esc(p.name)).join(", ") || "No parent linked"}</div></div>${sh ? `<button class="sm g" onclick="editStudent(${i})">Edit</button>` : ""}</div>`).join("") : '<p class="mu">No students in this class yet.</p>';
  m.innerHTML = `<h2>Students</h2><select onchange="S.cls=this.value;go('students')">${opts(cl, cur)}</select>
    <div class="fm"><b>Add student to ${esc(cur)}</b><input id="n_nm" placeholder="Full name"><select id="n_gd"><option>Male</option><option>Female</option></select>
    ${sh ? `<label class="l1">Parent 1</label><select id="n_p1">${parOpts()}</select><label class="l1">Parent 2 (optional)</label><select id="n_p2">${parOpts()}</select>` : ""}
    <button onclick="addStudent()">Add student</button></div>${rows}`;
};
async function addStudent() {
  const name = $("#n_nm").value.trim();
  if (!name) return toast("Write the student's name");
  const ids = staffHead() ? [$("#n_p1").value, $("#n_p2").value].filter(Boolean) : [];
  busy(true);
  try { await api("/students", "POST", { name, className: S.cls, gender: $("#n_gd").value, parentIds: [...new Set(ids)] }); toast("Student added ✅"); go("students"); }
  catch (e) { toast(e.message); }
  busy(false);
}
function editStudent(i) {
  const s = SL[i];
  openModal(`<h3>${esc(s.name)}</h3><label class="l1">Class</label><select id="e_cl">${opts(S.school.classes, s.className)}</select>
    <label class="l1">Parent 1</label><select id="e_p1">${parOpts(s.parents[0] && s.parents[0]._id)}</select>
    <label class="l1">Parent 2</label><select id="e_p2">${parOpts(s.parents[1] && s.parents[1]._id)}</select>
    <div class="noprint"><button onclick="saveStudent('${s._id}')">Save</button><button class="r" onclick="removeStudent('${s._id}')">Remove</button><button class="g" onclick="closeModal()">Close</button></div>`);
}
async function saveStudent(id) {
  const ids = [...new Set([$("#e_p1").value, $("#e_p2").value].filter(Boolean))];
  try { await api("/students/" + id, "PUT", { className: $("#e_cl").value, parents: ids }); closeModal(); toast("Saved ✅"); go("students"); }
  catch (e) { toast(e.message); }
}
async function removeStudent(id) {
  if (!confirm("Remove this student from the school list?")) return;
  try { await api("/students/" + id, "PUT", { active: false }); closeModal(); go("students"); } catch (e) { toast(e.message); }
}

/* ---------- parents / teachers / heads ---------- */
PS.people = async m => {
  const owner = S.user.role === "owner", role = S.pr || "parent";
  const list = await api("/auth/users?role=" + role);
  const tabs = [["parent", "Parents"], ["teacher", "Teachers"]].concat(owner ? [["head", "Heads"]] : []);
  const word = { parent: "parent", teacher: "teacher", head: "head teacher" }[role];
  m.innerHTML = `<h2>People</h2><div class="tabs">${tabs.map(t => `<button class="sm ${t[0] === role ? "y" : "g"}" onclick="S.pr='${t[0]}';go('people')">${t[1]}</button>`).join("")}</div>
    <div class="fm"><b>Add ${word}</b><input id="u_nm" placeholder="Full name"><input id="u_ph" placeholder="Phone e.g. 0244123456 (they can sign in with it)">
    <input id="u_em" type="email" placeholder="Email (optional for parents)" autocapitalize="none"><input id="u_pw" placeholder="Password (empty = 123456)">
    ${role === "teacher" ? `<label class="l1">Classes this teacher handles</label><div class="chk">${S.school.classes.map(c => `<label><input type="checkbox" class="u_cl" value="${esc(c)}">${esc(c)}</label>`).join("")}</div>` : ""}
    <button onclick="addUser('${role}')">Add ${word}</button></div>`
    + (list.length ? list.map(u => `<div class="c"><div class="g1"><b>${esc(u.name)}</b><div class="mu">${esc(u.phone || "")} ${u.email && !/@school-parent\.com$/.test(u.email) ? esc(u.email) : ""}</div>${u.classes && u.classes.length ? `<div class="mu">${esc(u.classes.join(", "))}</div>` : ""}</div></div>`).join("") : '<p class="mu">Nobody added yet.</p>');
};
async function addUser(role) {
  const classes = [...document.querySelectorAll(".u_cl:checked")].map(x => x.value);
  busy(true);
  try {
    await api("/auth/users", "POST", { role, name: $("#u_nm").value.trim(), phone: $("#u_ph").value.trim(), email: $("#u_em").value.trim(), password: $("#u_pw").value.trim(), classes });
    S.parents = null; toast("Added ✅"); go("people");
  } catch (e) { toast(e.message); }
  busy(false);
}

/* ---------- fees ---------- */
PS.fees = async m => {
  const f = await api("/fees");
  const tn = { tuition: "School fees", exam: "Exam fee", other: "Other" };
  m.innerHTML = `<h2>Fees</h2><div class="fm"><b>New fee</b><input id="f_t" placeholder="Title e.g. Term 1 School Fees">
    <select id="f_ty"><option value="tuition">School fees</option><option value="exam">Exam fee</option><option value="other">Other</option></select>
    <input id="f_a" type="number" placeholder="Amount (GHS)"><select id="f_c"><option value="all">All classes</option>${opts(S.school.classes)}</select>
    <label class="l1">Due date</label><input id="f_d" type="date"><button onclick="addFee()">Create fee</button></div>`
    + (f.length ? f.map(x => `<div class="c"><div class="g1"><b>${esc(x.title)}</b> <span class="badge">${tn[x.type] || x.type}</span>
    <div class="mu">${esc(x.className === "all" ? "All classes" : x.className)} · due ${new Date(x.dueDate).toLocaleDateString()}</div></div>
    <div style="text-align:right"><b>${money(x.amount)}</b><br><button class="r sm" onclick="delFee('${x._id}')">Delete</button></div></div>`).join("") : '<p class="mu">No fees yet.</p>');
};
async function addFee() {
  if (!$("#f_t").value.trim() || !$("#f_a").value || !$("#f_d").value) return toast("Fill in title, amount and due date");
  busy(true);
  try { await api("/fees", "POST", { title: $("#f_t").value.trim(), type: $("#f_ty").value, amount: +$("#f_a").value, className: $("#f_c").value, dueDate: $("#f_d").value }); toast("Fee created ✅"); go("fees"); }
  catch (e) { toast(e.message); }
  busy(false);
}
async function delFee(id) { if (!confirm("Delete this fee?")) return; try { await api("/fees/" + id, "DELETE"); go("fees"); } catch (e) { toast(e.message); } }

PS.owing = async m => {
  const d = await api("/fees/owing");
  window.OW = d;
  const sum = d.reduce((a, x) => a + x.owed, 0);
  const msg = x => `Dear parent, ${x.name} owes ${money(x.owed)} at ${S.school.name}. Please pay through the school app. Thank you.`;
  m.innerHTML = `<h2>Who owes</h2><p class="mu">${d.length} student(s) owe ${money(sum)}. Tap WhatsApp to remind a parent. Automatic reminders come in the next step.</p>`
    + (d.length ? d.map((x, i) => `<div class="c" style="display:block"><div style="display:flex"><div class="g1"><b>${esc(x.name)}</b> <span class="mu">${esc(x.className)}</span></div><b class="dn">${money(x.owed)}</b></div>
    ${(x.parents || []).map(p => `<div class="mu">${esc(p.name)} ${esc(p.phone || "")}</div>${p.phone ? `<a href="tel:${esc(p.phone)}"><button class="sm g">📞 Call</button></a> <a href="${wa(p.phone, msg(x))}" target="_blank"><button class="sm y">WhatsApp</button></a>` : ""}`).join("")}
    <div><button class="sm" onclick="cashModal(${i})">Record cash payment</button></div></div>`).join("") : '<p class="up">Nobody owes. 🎉</p>');
};
async function cashModal(i) {
  const x = OW[i];
  busy(true);
  try {
    const f = (await api("/fees/student/" + x.id)).filter(z => z.balance > 0);
    openModal(`<h3>${esc(x.name)}: record payment</h3>` + (f.length ? f.map(z => `<div class="c"><div class="g1"><b>${esc(z.title)}</b><div class="mu">Balance ${money(z.balance)}</div></div>
      <div style="width:120px"><input id="cs_${z.feeId}" type="number" value="${z.balance}"><button class="sm y" onclick="recCash('${x.id}','${z.feeId}')">Save</button></div></div>`).join("") : '<p class="mu">Nothing owed.</p>')
      + '<div class="noprint"><button class="g" onclick="closeModal()">Close</button></div>');
  } catch (e) { toast(e.message); }
  busy(false);
}
async function recCash(sid, fid) {
  busy(true);
  try { await api("/fees/cash", "POST", { studentId: sid, feeId: fid, amount: +$("#cs_" + fid).value }); toast("Payment recorded ✅"); closeModal(); go("owing"); }
  catch (e) { toast(e.message); }
  busy(false);
}

/* ---------- enter scores (one subject at a time) ---------- */
PS.scores = async m => {
  const y = new Date().getFullYear();
  m.innerHTML = `<h2>Enter scores</h2><div class="fm"><div class="r2"><select id="s_cl">${opts(tClasses())}</select><select id="s_ty"><option value="terminal">Terminal</option><option value="mock">Mock exam</option></select></div>
    <div class="r2"><select id="s_tm"><option>Term 1</option><option>Term 2</option><option>Term 3</option></select><input id="s_yr" type="number" value="${y}"></div>
    <select id="s_sb">${opts(S.school.subjects || [])}</select><button onclick="loadScores()">Load students</button></div><div id="s_tb"></div>`;
};
let SC = null;
async function loadScores() {
  const ctx = { className: $("#s_cl").value, term: $("#s_tm").value, year: +$("#s_yr").value, type: $("#s_ty").value, subject: $("#s_sb").value };
  const q = `className=${encodeURIComponent(ctx.className)}&term=${encodeURIComponent(ctx.term)}&year=${ctx.year}&type=${ctx.type}`;
  busy(true);
  try {
    const d = await api("/reports/class?" + q);
    SC = { ctx, students: d.students };
    if (!d.students.length) { $("#s_tb").innerHTML = '<p class="mu">No students in this class yet.</p>'; }
    else {
      $("#s_tb").innerHTML = `<p class="mu"><b>${esc(ctx.subject)}</b> · class score out of 50, exam score out of 50</p><div class="tw"><table class="t"><thead><tr><th class="pn">Student</th><th>Class (50)</th><th>Exam (50)</th><th>Total</th><th>Remark (optional)</th></tr></thead><tbody>`
        + d.students.map(s => {
          const rep = d.reports[s._id], x = (rep && rep.subjects.find(z => z.name === ctx.subject)) || {};
          return `<tr><td class="pn">${esc(s.name)}</td>
          <td><input type="number" min="0" max="50" data-s="${s._id}" data-k="c" value="${x.classScore == null ? "" : x.classScore}" oninput="sumRow('${s._id}')"></td>
          <td><input type="number" min="0" max="50" data-s="${s._id}" data-k="e" value="${x.examScore == null ? "" : x.examScore}" oninput="sumRow('${s._id}')"></td>
          <td id="sm_${s._id}"></td><td><input class="rm" data-s="${s._id}" data-k="r" placeholder="e.g. Good work" value="${esc(rep && rep.remark || "")}"></td></tr>`;
        }).join("") + '</tbody></table></div><button class="y" onclick="saveScores()">💾 Save scores</button>';
      d.students.forEach(s => sumRow(s._id));
    }
  } catch (e) { toast(e.message); }
  busy(false);
}
const cell = (id, k) => document.querySelector(`[data-s="${id}"][data-k="${k}"]`);
function sumRow(id) {
  const c = cell(id, "c").value, e = cell(id, "e").value;
  $("#sm_" + id).innerHTML = (c === "" && e === "") ? "" : "<b>" + ((+c || 0) + (+e || 0)) + "</b>";
}
async function saveScores() {
  const ctx = SC.ctx, items = [];
  SC.students.forEach(s => {
    const c = cell(s._id, "c").value, e = cell(s._id, "e").value, r = cell(s._id, "r").value;
    if (c !== "" || e !== "" || r.trim()) items.push({ studentId: s._id, subjects: [{ name: ctx.subject, classScore: c, examScore: e }], remark: r });
  });
  if (!items.length) return toast("Nothing to save yet");
  busy(true);
  try { const j = await api("/reports/bulk", "POST", { className: ctx.className, term: ctx.term, year: ctx.year, type: ctx.type, items }); toast("Saved for " + j.saved + " student(s) ✅"); }
  catch (e) { toast(e.message); }
  busy(false);
}

/* ---------- report cards (staff) ---------- */
PS.reports = async m => {
  const y = new Date().getFullYear();
  m.innerHTML = `<h2>Report cards</h2><div class="fm"><div class="r2"><select id="rc_cl">${opts(tClasses())}</select><select id="rc_ty"><option value="terminal">Terminal</option><option value="mock">Mock exam</option></select></div>
    <div class="r2"><select id="rc_tm"><option>Term 1</option><option>Term 2</option><option>Term 3</option></select><input id="rc_yr" type="number" value="${y}"></div><button onclick="loadReports()">Show</button></div><div id="rc_out"></div>`;
};
let RQ = null, RR = [];
async function loadReports() {
  RQ = { className: $("#rc_cl").value, term: $("#rc_tm").value, year: +$("#rc_yr").value, type: $("#rc_ty").value };
  const q = `className=${encodeURIComponent(RQ.className)}&term=${encodeURIComponent(RQ.term)}&year=${RQ.year}&type=${RQ.type}`;
  busy(true);
  try {
    const d = await api("/reports/class?" + q);
    const totals = d.students.filter(s => d.reports[s._id] && d.reports[s._id].subjects.length).map(s => tot(d.reports[s._id])).sort((a, b) => b - a);
    RR = d.students.map(s => {
      const rep = d.reports[s._id];
      if (!rep || !rep.subjects.length) return { name: s.name, none: true };
      const t = tot(rep);
      return { name: s.name, total: t, published: rep.published, rep: Object.assign({}, rep, { studentName: s.name, position: totals.indexOf(t) + 1, outOf: totals.length }) };
    });
    const sh = staffHead(), any = RR.some(x => !x.none), pubd = RR.some(x => x.published);
    $("#rc_out").innerHTML = (any ? '<button class="g" onclick="printAll()">🖨 Print all report cards</button>' : "") + (sh && any ? `<div class="r2"><button class="y" onclick="publishAll(true)">📤 Publish to parents</button><button class="g" onclick="publishAll(false)">Hide from parents</button></div>` : "")
      + (RR.length ? RR.map((x, i) => x.none ? `<div class="c"><div class="g1"><b>${esc(x.name)}</b><div class="mu">No scores yet</div></div></div>`
        : `<div class="c"><div class="g1"><b>${esc(x.name)}</b><div class="mu">Total ${x.total} · Position ${x.rep.position} of ${x.rep.outOf}</div></div><span class="badge ${x.published ? "ok" : ""}">${x.published ? "Published" : "Hidden"}</span><button class="sm" onclick="showReport(RR[${i}].rep)">View</button></div>`).join("")
        : '<p class="mu">No students in this class.</p>');
  } catch (e) { toast(e.message); }
  busy(false);
}
function printAll() { showReports(RR.filter(x => !x.none).map(x => x.rep)); }
async function publishAll(flag) {
  if (!confirm(flag ? "Parents will see these report cards. Continue?" : "Hide these report cards from parents?")) return;
  busy(true);
  try { await api("/reports/publish", "POST", Object.assign({ published: flag }, RQ)); toast(flag ? "Published ✅" : "Hidden"); await loadReports(); }
  catch (e) { toast(e.message); }
  busy(false);
}

/* ---------- school settings (owner) ---------- */
PS.settings = async m => {
  const s = S.school, r = s.reminder || {};
  S.newLogo = "";
  m.innerHTML = `<h2>School settings</h2>
    <div class="fm"><b>School look</b><label class="l1">School name (loading page and menu)</label><input id="st_n" value="${esc(s.name)}">
    <label class="l1">Name on receipts and report cards</label><input id="st_i" value="${esc(s.invoiceName || s.name)}">
    <label class="l1">Motto (shown on the loading page)</label><input id="st_m" value="${esc(s.motto || "")}">
    <label class="l1">Address</label><input id="st_ad" value="${esc(s.address || "")}"><label class="l1">Phone</label><input id="st_ph" value="${esc(s.phone || "")}">
    <label class="l1">Logo</label><div style="display:flex;gap:10px;align-items:center"><div class="lgpv" id="lg_pv">${logoHTML()}</div><input type="file" accept="image/*" onchange="pickLogo(this)"></div>
    <div class="r2"><div><label class="l1">Main colour</label><input id="st_p" type="color" value="${esc((s.colors || {}).primary || "#0b2a8f")}"></div><div><label class="l1">Accent colour</label><input id="st_a" type="color" value="${esc((s.colors || {}).accent || "#f5b800")}"></div></div></div>
    <div class="fm"><b>Report card colour</b><p class="mu">Parents and staff see report cards in this colour.</p><select id="st_th">${Object.keys(THEMES).map(k => `<option value="${k}"${(s.reportTheme || "y") === k ? " selected" : ""}>${THEMES[k]}</option>`).join("")}</select></div>
    <div class="fm"><b>Classes</b><p class="mu">One per line, from the lowest class to the highest.</p><textarea id="st_cl" rows="8">${esc((s.classes || []).join("\n"))}</textarea></div>
    <div class="fm"><b>Subjects</b><p class="mu">One per line. These appear on report cards.</p><textarea id="st_sb" rows="8">${esc((s.subjects || []).join("\n"))}</textarea></div>
    <div class="fm"><b>Fee reminders to parents</b><label class="chk1" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="st_re" ${r.enabled ? "checked" : ""}> Send reminders automatically</label>
    <label class="l1">Send by</label><select id="st_ch"><option value="sms"${r.channel === "sms" ? " selected" : ""}>SMS</option><option value="whatsapp"${r.channel === "whatsapp" ? " selected" : ""}>WhatsApp</option></select>
    <label class="l1">Remind parents who owe for this many months or more</label><input id="st_ml" type="number" min="0" value="${r.monthsLimit == null ? 1 : r.monthsLimit}">
    <label class="l1">Send on this day of the month (1-28)</label><input id="st_dy" type="number" min="1" max="28" value="${r.dayOfMonth || 1}">
    <label class="l1">Message ({student} {amount} {school} are filled in automatically)</label><textarea id="st_ms" rows="3">${esc(r.message || "")}</textarea>
    <p class="mu">The sending itself is switched on in the next step.</p></div>
    <button class="y" onclick="saveSettings()">💾 Save settings</button>`;
};
function pickLogo(inp) {
  const f = inp.files[0]; if (!f) return;
  const fr = new FileReader(), img = new Image();
  fr.onload = () => { img.onload = () => {
    const k = Math.min(1, 256 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    S.newLogo = c.toDataURL("image/png");
    $("#lg_pv").innerHTML = `<img src="${S.newLogo}">`;
  }; img.src = fr.result; };
  fr.readAsDataURL(f);
}
async function saveSettings() {
  const body = {
    name: $("#st_n").value.trim(), invoiceName: $("#st_i").value.trim(), motto: $("#st_m").value.trim(),
    address: $("#st_ad").value.trim(), phone: $("#st_ph").value.trim(),
    colors: { primary: $("#st_p").value, accent: $("#st_a").value },
    reportTheme: $("#st_th").value,
    classes: lines("#st_cl"), subjects: lines("#st_sb"),
    reminder: { enabled: $("#st_re").checked, channel: $("#st_ch").value, monthsLimit: +$("#st_ml").value, dayOfMonth: +$("#st_dy").value, message: $("#st_ms").value.trim() }
  };
  if (!body.name) return toast("School name cannot be empty");
  if (S.newLogo) body.logo = S.newLogo;
  busy(true);
  try {
    const s = await api("/school/mine", "PUT", body);
    S.school = null; brand(s);
    localStorage.setItem("brand", JSON.stringify(pub(s)));
    buildMenu(); toast("Saved ✅"); go("settings");
  } catch (e) { toast(e.message); }
  busy(false);
}
