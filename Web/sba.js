/* sba.js - the whole TSCS SBA system, built into the school app.
   Scores (tests + exam), attendance, conduct, report cards, analysis sheets, Basic 9 mock exams. */
(function () {
  const sb = window.sb = {};
  const X = { cls: localStorage.sbC || "", term: localStorage.sbT || "Term 1", yr: +localStorage.sbY || new Date().getFullYear(),
    sub: "", rp: "", th: "", am: "d", date: "", mk: +localStorage.sbM || 1, mv: "e" };
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  X.date = today();
  const save = () => { localStorage.sbC = X.cls; localStorage.sbT = X.term; localStorage.sbY = X.yr; localStorage.sbM = X.mk; };
  let D = null;                                              // the class that is open
  const isHead = () => ["owner", "head"].includes(S.user.role);
  const sc = () => S.school || {};
  const subsOf = c => SBC.subs(sc().subjects, c);
  const noStu = () => '<p class="mu">No students in this class yet. Add them in the Students page.</p>';
  const unf = () => { const a = document.activeElement; if (a && a.blur) a.blur(); };
  const body = () => ({ className: X.cls, term: X.term, year: X.yr });
  const fm = n => "GH₵" + (+n || 0).toFixed(2);
  const reps = t => (D.reports[t] = D.reports[t] || {});
  const rpt = (t, id) => reps(t)[id] || (reps(t)[id] = { studentId: id, type: t, subjects: [] });
  const ent = (r, n) => { let e = r.subjects.find(x => x.name === n); if (!e) { e = { name: n }; r.subjects.push(e); } return e; };
  const meta = id => ((D.meta.students = D.meta.students || {})[id]) || {};
  const packFor = (id, type) => SBC.pack(D, D.students.find(s => s._id === id), type || "terminal");
  const ABR = { "English Language": "ENG", "English": "ENG", "Mathematics": "MATHS", "Science": "SCI", "Integrated Science": "INT.SCI", "Social Studies": "SOC.STD", "Computing": "COMP", "Creative Arts": "C.ARTS", "French": "FRE", "Twi": "TWI", "Ghanaian Language": "GH.LANG", "Career Technology": "CAR.TECH", "History": "HIST" };
  const ab = x => ABR[x] || x.slice(0, 5).toUpperCase();
  const DEF = {
    cd: ["Respectful and well-behaved", "Obedient and hardworking", "Polite and cooperative", "Disciplined and responsible", "Is an enthusiastic learner who seems to enjoy school", "Needs to improve his/her conduct"],
    at: ["Humble", "Hardworking", "Cheerful", "Attentive", "Eager to learn", "Needs to be more serious"],
    it: ["Literacy", "Numeracy", "Reading", "Sports", "Drawing and Colouring", "Music and Dance", "Science", "Creative Arts", "Computing"],
    tr: ["Well done.", "Keep it up.", "Excellent performance. Keep it up!", "Good effort. Aim higher.", "Needs to work harder."]
  };
  const LST = k => { const l = (D && D.lists && D.lists[k]) || (sc().lists || {})[k]; return l && l.length ? l : DEF[k]; };

  /* ---------- load a class ---------- */
  async function ensure() {
    const cl = tClasses();
    if (!cl.includes(X.cls)) X.cls = cl[0] || "";
    if (!X.cls) throw new Error("No classes yet. The owner adds classes in School Settings.");
    D = await api(`/sba/class?className=${encodeURIComponent(X.cls)}&term=${encodeURIComponent(X.term)}&year=${X.yr}`);
    D.className = X.cls; D.term = X.term; D.year = X.yr; D.subjects = subsOf(X.cls);
    S.school.lists = D.lists; S.school.signature = D.signature;
  }
  const bar = () => `<div class="r2"><select onchange="sb.c(this.value)">${opts(tClasses(), X.cls)}</select><select onchange="sb.t(this.value)">${opts(["Term 1", "Term 2", "Term 3"], X.term)}</select><input type="number" value="${X.yr}" onchange="sb.y(this.value)"></div>`;
  sb.c = v => { X.cls = v; save(); go(S.page); };
  sb.t = v => { X.term = v; save(); go(S.page); };
  sb.y = v => { X.yr = +v || X.yr; save(); go(S.page); };
  const thSel = () => `<select onchange="sb.th(this.value)">${Object.keys(themeList()).map(k => `<option value="${k}"${k === themeOf(X.th) ? " selected" : ""}>${themeList()[k]}</option>`).join("")}</select>${inkSel()}`;
  sb.th = v => { X.th = v; unf(); if (S.page === "reports") rcv(); else if (S.page === "mock") drawMock(); };
  async function saveMeta(id, patch, quiet) {
    D.meta = D.meta || {};
    const { ph, ...rest } = patch;
    if (ph !== undefined) { const s = D.students.find(x => x._id === id); if (s) s.photo = ph; }
    if (id) { const o = (D.meta.students = D.meta.students || {}); o[id] = Object.assign({}, o[id] || {}, rest); }
    else D.meta.cls = Object.assign({}, D.meta.cls || {}, rest);
    try { await api("/sba/meta", "POST", Object.assign(body(), { studentId: id, patch })); if (!quiet) toast("Saved ✅"); }
    catch (e) { toast("Not saved: " + e.message); }
  }

  /* ---------- overview (owner / head) ---------- */
  PS.overview = async m => {
    const d = await api(`/sba/overview?term=${encodeURIComponent(X.term)}&year=${X.yr}`);
    X.ov = d;
    m.innerHTML = `<h2>SBA overview</h2><div class="r2"><select onchange="sb.t(this.value)">${opts(["Term 1", "Term 2", "Term 3"], X.term)}</select><input type="number" value="${X.yr}" onchange="sb.y(this.value)"></div>
      <p class="mu">Tap a class to open its scores.</p>` + d.map((c, i) => `<div class="c" style="cursor:pointer" onclick="sb.goC(${i})"><div class="g1"><b>${esc(c.className)}</b>
      <div class="mu">${c.pupils} students · ${c.started} of ${c.subjects} subjects started</div><div class="bar"><i style="width:${c.pct}%"></i></div></div><b>${c.pct}%</b></div>`).join("");
  };
  sb.goC = i => { X.cls = X.ov[i].className; save(); go("scores"); };

  /* ---------- scores ---------- */
  PS.scores = async m => {
    await ensure();
    const ss = D.subjects; if (!ss.includes(X.sub)) X.sub = ss[0];
    m.innerHTML = `<h2>Enter scores</h2>${bar()}<select onchange="sb.s(this.value)">${opts(ss, X.sub)}</select>` + (!ss.length ? '<p class="mu">The owner must add subjects in School Settings.</p>' : !D.students.length ? noStu()
      : `<p class="mu">3 tests /20 · project /10 · group /10 → scaled to 50. Exam /100 → scaled to 50. Saves as you type and every teacher sees it.</p>
      <div class="tw"><table class="t"><thead><tr><th class="pn">Student</th><th>Test 1<br>/20</th><th>Test 2<br>/20</th><th>Test 3<br>/20</th><th>Project<br>/10</th><th>Group<br>/10</th><th>Exam<br>/100</th><th>Class<br>/50</th><th>Exam<br>/50</th><th>Total</th><th>Grd</th><th>Pos</th><th>Remark</th></tr></thead><tbody>`
      + D.students.map(s => `<tr data-id="${s._id}"><td class="pn">${esc(s.name)}</td>${SBC.MX.map((mx, i) => `<td><input type="number" inputmode="numeric" min="0" max="${mx}" data-i="${i}" data-m="${mx}" onchange="sb.sc(this)"></td>`).join("")}
      <td class="q-c"></td><td class="q-e"></td><td class="q-t sbv"></td><td class="q-g"></td><td class="q-p"></td><td class="q-m sbr"></td></tr>`).join("") + "</tbody></table></div>");
    fillSc();
  };
  sb.s = v => { X.sub = v; go("scores"); };
  function fillSc() {
    if (S.page !== "scores" || !D.students.length) return;
    SBC.calc(D.subjects, D.students, reps("terminal"), X.cls).forEach(o => {
      const tr = document.querySelector(`tr[data-id="${o.s._id}"]`); if (!tr) return;
      const r = reps("terminal")[o.s._id], e = r && r.subjects.find(z => z.name === X.sub), a = (e && e.raw) || [], y = o.sub[X.sub];
      tr.querySelectorAll("input").forEach((el, i) => { if (document.activeElement !== el) el.value = a[i] == null ? "" : a[i]; });
      const set = (c, v) => tr.querySelector(".q-" + c).textContent = v;
      set("c", y ? y.c : ""); set("e", y ? y.e : ""); set("t", y ? y.t : ""); set("g", y ? y.g : ""); set("p", y ? SBC.ord(y.p) : ""); set("m", y ? y.m : "");
    });
  }
  sb.sc = async el => {
    const id = el.closest("tr").dataset.id, m = +el.dataset.m, i = +el.dataset.i;
    const v = el.value === "" ? null : Math.round(Math.max(0, Math.min(m, +el.value)));
    if (v !== null && v != +el.value) el.value = v;
    const e = ent(rpt("terminal", id), X.sub), a = (e.raw && e.raw.length ? e.raw.slice() : [null, null, null, null, null, null]);
    a[i] = v; e.raw = a;
    const c = SBC.cs({ raw: a }); e.classScore = c ? c.c : undefined; e.examScore = c ? c.e : undefined;
    fillSc();
    try { await api("/sba/score", "POST", Object.assign(body(), { type: "terminal", studentId: id, subject: X.sub, raw: a })); }
    catch (er) { toast("Not saved: " + er.message); }
  };

  /* ---------- attendance ---------- */
  PS.attendance = async m => { await ensure(); drawAt(); };
  function drawAt() {
    const st = D.students, days = Object.keys(D.att).length, A = D.att[X.date] || {};
    const tabs = `<div class="r2"><button class="${X.am === "d" ? "y" : "g"}" onclick="sb.am('d')">📅 Daily marking</button><button class="${X.am === "s" ? "y" : "g"}" onclick="sb.am('s')">🧮 Term totals</button></div>`;
    let h = "";
    if (!st.length) h = noStu();
    else if (X.am === "d") {
      const pr = st.filter(s => A[s._id] === "P").length, ab2 = st.filter(s => A[s._id] === "A").length;
      h = `<div class="fm"><b>Daily attendance, ${esc(X.cls)}</b><input type="date" value="${X.date}" onchange="sb.dt(this.value)"><div class="r2"><button class="y" onclick="sb.allP()">✔ Everyone present</button><button class="r" onclick="sb.clr()">Clear this day</button></div>
        <p class="mu" style="margin-bottom:0">Present ${pr} · Absent ${ab2} · Not marked ${st.length - pr - ab2} · ${days} school day(s) recorded this term. It saves at once and goes to the report cards.</p></div>`
        + st.map(s => { const p = Object.values(D.att).filter(d => d[s._id] === "P").length; return `<div class="c"><div class="g1"><b>${esc(s.name)}</b><div class="mu">Present ${p} of ${days} days</div></div>
          <div class="ac"><button class="${A[s._id] === "P" ? "pp1" : "off"}" onclick="sb.mark('${s._id}','P')">P</button><button class="${A[s._id] === "A" ? "aa1" : "off"}" onclick="sb.mark('${s._id}','A')">A</button></div></div>`; }).join("");
    } else {
      const C = D.meta.cls || {};
      h = `<div class="fm"><b>Term attendance totals, ${esc(X.cls)}</b><label class="l1">Total days school opened this term (once for the whole class)</label><input type="number" inputmode="numeric" min="0" value="${esc(C.opened)}" placeholder="${days ? days + " (counted from daily marks)" : "e.g. 60"}" data-k="opened" data-c="1" onchange="sb.mv(this)">
        <p class="mu" style="margin-bottom:0">Then write how many days each student came. If you leave a student empty, that student's daily marks are used.</p></div>`
        + st.map(s => { const dp = Object.values(D.att).filter(d => d[s._id] === "P").length; return `<div class="c"><div class="g1"><b>${esc(s.name)}</b><div class="mu">Daily marks: ${dp} present</div></div>
          <input type="number" inputmode="numeric" min="0" value="${esc(meta(s._id).days)}" placeholder="days" style="width:84px;text-align:center" data-id="${s._id}" onchange="sb.days(this)"></div>`; }).join("");
    }
    $("#main").innerHTML = `<h2>Attendance</h2>${bar()}${tabs}${h}`;
  }
  sb.am = v => { X.am = v; unf(); drawAt(); };
  sb.dt = v => { if (!v) return; const d = new Date(v + "T12:00:00").getDay(); if ((d === 0 || d === 6) && !confirm("That date is a weekend. Mark attendance anyway?")) { drawAt(); return; } X.date = v; drawAt(); };
  async function putAt(marks, clear) {
    try { await api("/sba/attendance", "POST", Object.assign(body(), { date: X.date, marks, clear })); return true; }
    catch (e) { toast("Not saved: " + e.message); return false; }
  }
  sb.mark = async (id, v) => { (D.att[X.date] = D.att[X.date] || {})[id] = v; drawAt(); await putAt({ [id]: v }); };
  sb.allP = async () => { const v = {}; D.students.forEach(s => v[s._id] = "P"); D.att[X.date] = Object.assign(D.att[X.date] || {}, v); drawAt(); if (await putAt(v)) toast("Everyone marked present ✅"); };
  sb.clr = async () => { if (!confirm("Clear all attendance for " + X.date + "?")) return; delete D.att[X.date]; drawAt(); if (await putAt({}, true)) toast("Day cleared"); };
  sb.days = async el => { let v = el.value; if (v !== "") { v = Math.max(0, Math.round(+v)); const o = +((D.meta.cls || {}).opened); if (o && v > o) v = o; el.value = v; } await saveMeta(el.dataset.id, { days: v }); };

  /* ---------- conduct, attitude, interest ---------- */
  const CNF = [["cd", "Conduct"], ["at", "Attitude"], ["it", "Interest"]];
  const cnOpts = (k, cur) => { const l = LST(k).slice(); if (cur && !l.includes(cur)) l.unshift(cur); return '<option value="">— choose —</option>' + l.map(x => `<option value="${esc(x)}"${x === cur ? " selected" : ""}>${esc(x)}</option>`).join(""); };
  PS.conduct = async m => {
    await ensure();
    m.innerHTML = `<h2>Conduct</h2>${bar()}` + (!D.students.length ? noStu() : `<p class="mu">Choose conduct, attitude and interest for each student. It saves at once and shows on the report card.</p>
      <div class="fm"><b>Same for the whole class</b><p class="mu">Pick one and tap Apply to give it to every student. You can still change single students below.</p>${CNF.map(f => `<label class="l1">${f[1]}</label><div class="r2"><select id="ca_${f[0]}">${cnOpts(f[0], "")}</select><button class="y" style="flex:none;width:90px" onclick="sb.cnAll('${f[0]}')">Apply</button></div>`).join("")}</div>`
      + D.students.map(s => { const M = meta(s._id); return `<div class="fm"><b>${esc(s.name)}</b>${CNF.map(f => `<label class="l1">${f[1]}</label><select data-k="${f[0]}" data-id="${s._id}" onchange="sb.cn(this)">${cnOpts(f[0], M[f[0]])}</select>`).join("")}</div>`; }).join("")
      + `<div class="fm"><b>Ready-made lists (the same for every class)</b><p class="mu">One per line. They show in the choose menus, and in the class teacher's remarks.</p>
      ${[["cd", "Conduct", 4], ["at", "Attitude", 3], ["it", "Interest", 3], ["tr", "Class teacher's remarks", 3]].map(f => `<label class="l1">${f[1]}</label><textarea id="ls_${f[0]}" rows="${f[2]}">${esc(LST(f[0]).join("\n"))}</textarea>`).join("")}<button class="y" onclick="sb.saveL()">Save lists</button></div>`);
  };
  sb.cn = el => saveMeta(el.dataset.id, { [el.dataset.k]: el.value });
  sb.cnAll = async k => {
    const v = $("#ca_" + k).value; if (!v || !D.students.length) return;
    if (!confirm("Give this to all " + D.students.length + " students in " + X.cls + "?")) return;
    const items = D.students.map(s => ({ studentId: s._id, patch: { [k]: v } }));
    items.forEach(i => { const o = (D.meta.students = D.meta.students || {}); o[i.studentId] = Object.assign({}, o[i.studentId] || {}, i.patch); });
    try { await api("/sba/meta", "POST", Object.assign(body(), { items })); toast("Applied to whole class ✅"); } catch (e) { toast("Not saved: " + e.message); }
    go("conduct");
  };
  sb.saveL = async () => {
    const g = k => $("#ls_" + k).value.split("\n").map(x => x.trim()).filter(Boolean), lists = { cd: g("cd"), at: g("at"), it: g("it"), tr: g("tr") };
    try { await api("/sba/settings", "POST", { lists }); D.lists = Object.assign({}, D.lists, lists); S.school.lists = D.lists; toast("Saved ✅"); } catch (e) { toast(e.message); }
  };

  /* ---------- report card pieces ---------- */
  const auto = a => a >= 80 ? "Excellent performance. Keep it up!" : a >= 70 ? "Very good work. Aim even higher." : a >= 60 ? "Good effort. Keep working hard." : a >= 50 ? "Fair performance. More effort is needed." : a >= 40 ? "Weak result. Needs serious improvement." : "Very poor result. Needs close supervision.";
  const GT = j => j ? [[80, 100, 1, "Highest"], [70, 79, 2, "Higher"], [60, 69, 3, "High"], [55, 59, 4, "High Average"], [50, 54, 5, "Average"], [45, 49, 6, "Low Average"], [40, 44, 7, "Low"], [35, 39, 8, "Lower"], [0, 34, 9, "Lowest"]]
    : [[90, 100, "A+", "Excellent"], [80, 89, "A", "Very Good"], [70, 79, "B", "Good"], [60, 69, "C", "Satisfactory"], [50, 59, "D", "Fair"], [40, 49, "E", "Weak"], [0, 39, "F", "Needs Improvement"]];
  const KEYJ = "1: 80–100 Highest · 2: 70–79 Higher · 3: 60–69 High · 4: 55–59 High Average · 5: 50–54 Average · 6: 45–49 Low Average · 7: 40–44 Low · 8: 35–39 Lower · 9: 0–34 Lowest";
  const sigImg = () => sc().signature ? `<img class="sb-sig" src="${esc(sc().signature)}" alt="">` : "";
  function head(sub) {
    const s = sc(), l = [];
    if (s.phone) l.push(`<b>Contact:</b> ${esc(s.phone)}`);
    if (s.email || s.website) l.push([s.email && `<b>Email:</b> ${esc(s.email)}`, s.website && `<b>Website:</b> ${esc(s.website)}`].filter(Boolean).join(" | "));
    if (s.address) l.push(`<b>Location:</b> ${esc(s.address)}`);
    return `<div class="x-head"><div class="x-logo">${logoHTML()}</div><div class="x-hm"><h2>${esc(s.invoiceName || s.name)}</h2>${sub ? `<p class="x-mt">${esc(sub)}</p>` : l.map(x => `<p>${x}</p>`).join("")}</div></div>`;
  }
  function chart(o, ss) {
    const L = ss.filter(x => o.sub[x]); if (!L.length) return "";
    const W = 400, H = 175, l = 28, b = 46, t = 14, pw = W - l - 6, ph = H - b - t, bw = pw / L.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">`;
    [0, 20, 40, 60, 80, 100].forEach(v => { const y = t + ph - ph * v / 100; s += `<line x1="${l}" x2="${W - 6}" y1="${y}" y2="${y}" stroke="#ddd"/><text x="${l - 4}" y="${y + 3}" font-size="8" text-anchor="end" fill="#666">${v}</text>`; });
    L.forEach((x, i) => { const v = o.sub[x].t, h = ph * v / 100, cx = l + bw * i + bw / 2, lab = L.length > 6 ? ab(x) : x.toUpperCase();
      s += `<rect x="${cx - bw * .36}" y="${t + ph - h}" width="${bw * .72}" height="${h}" style="fill:var(--ac)"/><text x="${cx}" y="${t + ph - h - 2}" font-size="8" text-anchor="middle" fill="#222">${v}</text><text transform="translate(${cx},${t + ph + 8}) rotate(-25)" font-size="7" text-anchor="end" fill="#555">${esc(lab)}</text>`; });
    return s + "</svg>";
  }
  // END OF TERM report card
  function card(P, th) {
    th = themeOf(th || X.th);
    const o = P.o, M = P.M || {}, C = P.C || {}, j = SBC.jhs(P.cls), ss = subsOf(P.cls), b = v => `<b class="ink">${esc(v || "")}</b>`;
    const hasB = [C.tui, C.pta, C.toi, M.arr].some(v => v !== undefined && v !== "" && v !== null), tot = (+M.arr || 0) + (+C.tui || 0) + (+C.pta || 0) + (+C.toi || 0);
    const att = P.opened ? P.present + " out of " + P.opened : (P.hasD ? P.present + " days" : "");
    return `<div class="rc2 th-${th}">${head()}<div class="x-ban">END OF TERM REPORT</div>
<div class="x-info"><div class="x-grid"><div><small>Name</small>${b(P.s.name.toUpperCase())}</div><div><small>Class</small>${b(P.cls.toUpperCase())}</div><div><small>Term / Year</small>${b(P.term + " / " + P.year)}</div><div><small>No. on roll</small>${b(P.onRoll)}</div><div><small>Vac date</small>${b(C.vacate)}</div><div><small>Open date</small>${b(C.reopen)}</div></div>
<div class="x-photo">${P.s.photo ? `<img src="${esc(P.s.photo)}" alt="">` : esc(P.s.name.trim().charAt(0).toUpperCase())}</div></div>
<table class="x-tbl"><thead><tr><th class="l">SUBJECT</th><th>CLASS (50%)</th><th>EXAM (50%)</th><th>TOTAL (100%)</th><th>GRADE</th><th>POS.</th><th class="l">REMARKS</th></tr></thead><tbody>${ss.map(x => { const y = o.sub[x]; return `<tr><td class="sj">${esc(x)}</td><td>${y ? y.c : ""}</td><td>${y ? y.e : ""}</td><td>${y ? y.t : ""}</td><td>${y ? y.g : ""}</td><td>${y ? SBC.ord(y.p) : ""}</td><td class="l">${y ? y.m : ""}</td></tr>`; }).join("")}</tbody></table>
<div class="x-sum"><div><small>Average score</small><b>${o.n ? o.avg : ""}</b></div><div><small>Total marks</small><b>${o.n ? o.gt : ""}</b></div>${j ? `<div><small>Aggregate</small><b>${o.ag ?? ""}</b></div>` : ""}<div><small>Attendance</small><b>${att}</b></div></div>
<div class="x-grid" style="margin-bottom:8px"><div><small>Conduct</small>${b(M.cd)}</div><div><small>Attitude</small>${b(M.at)}</div><div><small>Interest</small>${b(M.it)}</div></div>
<div class="x-cg"><div><h4 class="sb-h4">Graphical Representation of Scores</h4>${chart(o, ss)}</div><div><h4 class="sb-h4">Grading System</h4><table class="x-gt"><thead><tr><th>Min</th><th>Max</th><th>Grade</th><th class="l">Remarks</th></tr></thead><tbody>${GT(j).map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="l">${r[3]}</td></tr>`).join("")}</tbody></table></div></div>
${hasB ? `<div class="sb-bl"><h4 class="sb-h4">Student Bill for Next Term</h4><table class="x-gt"><tr><th>Arrears</th><th>Tuition</th><th>P.T.A</th><th>Toiletries</th><th>Total</th></tr><tr><td>${fm(M.arr)}</td><td>${fm(C.tui)}</td><td>${fm(C.pta)}</td><td>${fm(C.toi)}</td><td><b>${fm(tot)}</b></td></tr></table></div>` : ""}
<div class="sb-ft"><div><b>Class Teacher's Comment:</b> ${esc(M.tr || (o.n ? auto(o.avg) : ""))}${M.hr ? `<br><b>Head Teacher's Remarks:</b> ${esc(M.hr)}` : ""}${M.promo ? `<br><b>Promoted to:</b> ${esc(M.promo)}` : ""}</div><div class="sb-hs"><b>Headmaster's Signature:</b> ${sigImg() || '<span class="sb-dl"></span>'}</div></div></div>`;
  }
  // MOCK result slip
  function mcard(P, th) {
    th = themeOf(th || X.th);
    const ss = subsOf(P.cls), o = P.o, pv = P.prev, st = P.st, n = P.n;
    const tr = (a, b) => a > b ? `<span class="up">▲ ${a - b}</span>` : a < b ? `<span class="dn">▼ ${b - a}</span>` : "＝";
    const L = ss.filter(x => o.sub[x]).sort((a, b) => o.sub[b].t - o.sub[a].t), best = L[0], worst = L[L.length - 1], ag = o.ag;
    const band = ag == null ? "" : ag <= 10 ? "Excellent" : ag <= 15 ? "Very good" : ag <= 24 ? "Good" : ag <= 35 ? "Fair" : "Needs urgent work";
    let prog = "First mock";
    if (n > 1) { if (pv && pv.ag != null && ag != null) prog = ag < pv.ag ? `<span class="up">▲ Improved by ${pv.ag - ag}</span>` : ag > pv.ag ? `<span class="dn">▼ Dropped by ${ag - pv.ag}</span>` : "＝ Same aggregate"; else if (pv && pv.n && o.n) prog = tr(o.avg, pv.avg) + " avg"; else prog = "–"; }
    const rows = ss.map(x => { const y = o.sub[x], py = pv && pv.sub[x], w = y ? Math.min(100, y.t) : 0;
      return `<tr><td class="sj">${esc(x)}</td><td class="ink" style="background:linear-gradient(90deg,var(--bar) ${w}%,transparent ${w}%)">${y ? y.t : ""}</td><td class="ink">${y ? y.g : ""}</td><td class="ink l">${y ? y.m : ""}</td><td class="ink">${y ? SBC.ord(y.p) : ""}</td><td class="ink">${(st[x] || {}).av ?? ""}</td><td class="ink">${y && py ? tr(y.t, py.t) : "–"}</td></tr>`; }).join("");
    const b = v => `<b class="ink">${esc(v)}</b>`;
    return `<div class="rc2 mk th-${th}"><div class="x-stamp">MOCK<b>${n}</b></div>${head(sc().motto || "Our vision · Your future")}<div class="x-ban">BECE MOCK EXAMINATION ${n} · RESULT SLIP</div>
<div class="x-info"><div class="x-grid"><div><small>Candidate</small>${b(P.s.name)}</div><div><small>Class</small>${b(P.cls)}</div><div><small>Examination</small>${b("Mock " + n)}</div><div><small>Academic year</small>${b(P.year + " · " + P.term)}</div></div></div>
<table class="x-tbl"><thead><tr><th class="l">Subject</th><th>Score /100</th><th>Grade (1–9)</th><th class="l">Remark</th><th>Position</th><th>Class average</th><th>Vs Mock ${n > 1 ? n - 1 : "–"}</th></tr></thead><tbody>${rows}</tbody></table>
<div class="x-sum"><div><small>Total marks</small><b>${o.n ? o.gt + " / " + o.n * 100 : ""}</b></div><div><small>Average</small><b>${o.n ? o.avg + "%" : ""}</b></div><div><small>Aggregate</small><b>${ag ?? ""}</b></div><div><small>Overall position</small><b>${o.pos ? SBC.ord(o.pos) + " of " + P.onRoll : ""}</b></div></div>
<div class="x-sum"><div><small>Readiness</small><b>${band}</b></div><div><small>Strongest subject</small><b>${best ? esc(best) + " (" + o.sub[best].t + ")" : ""}</b></div><div><small>Needs most work</small><b>${worst && L.length > 1 ? esc(worst) + " (" + o.sub[worst].t + ")" : ""}</b></div><div><small>${n > 1 ? "Vs Mock " + (n - 1) : "Progress"}</small><b>${prog}</b></div></div>
<p class="sb-nt"><b>How to read this slip:</b> grade 1 is the best and 9 the lowest. Aggregate = 4 core subjects (English, Mathematics, Science, Social Studies) + the best 2 others; the lower the aggregate, the better. A mock is practice for the BECE, so use the weakest subjects to plan your revision.</p>
<div class="x-sign"><div style="position:relative">${sigImg()}Head teacher's signature</div><div>Date</div></div><p class="sb-nt"><b>Grading key:</b> ${KEYJ}</p></div>`;
  }

  /* ---------- report cards page ---------- */
  PS.reports = async m => { await ensure(); rcv(); };
  const pubBar = type => {
    if (!isHead()) return "";
    const r = Object.values(reps(type)), n = r.filter(x => x.published).length;
    return `<div class="fm"><b>Parents</b><p class="mu">${n} of ${r.length} report cards are visible to parents.</p><div class="r2"><button class="y" onclick="sb.pub('${type}',true)">📤 Publish to parents</button><button class="g" onclick="sb.pub('${type}',false)">Hide from parents</button></div></div>`;
  };
  sb.pub = async (type, flag) => {
    if (!confirm(flag ? "Parents will see these report cards. Continue?" : "Hide these report cards from parents?")) return;
    busy(true);
    try { await api("/reports/publish", "POST", Object.assign(body(), { type, published: flag })); Object.values(reps(type)).forEach(r => r.published = flag); toast(flag ? "Published ✅" : "Hidden"); S.page === "mock" ? drawMock() : rcv(); }
    catch (e) { toast(e.message); }
    busy(false);
  };
  function rcv() {
    const st = D.students, mn = $("#main");
    if (!st.length) { mn.innerHTML = `<h2>Report cards</h2>${bar()}${noStu()}`; return; }
    if (!st.find(s => s._id === X.rp)) X.rp = st[0]._id;
    const s = st.find(x => x._id === X.rp), M = meta(X.rp), C = D.meta.cls || {};
    const inp = (l, k, v, t, c) => `<label class="l1">${l}</label><input data-k="${k}"${c ? ' data-c="1"' : ""} ${t || ""} value="${esc(v || "")}" onchange="sb.mv(this)">`;
    mn.innerHTML = `<h2>Report cards</h2>${bar()}<select onchange="sb.rp(this.value)">${st.map(x => `<option value="${x._id}"${x._id === X.rp ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>${thSel()}
    <div class="r2"><button class="y" onclick="sb.pc(0,'terminal')">🖨 Print / save this card</button><button onclick="sb.pc(1,'terminal')">🖨 Print / save all ${st.length}</button></div>${pubBar("terminal")}
    <div class="sheetbox" id="sb_pv">${card(packFor(X.rp))}</div>
    <div class="fm"><b>Notes for ${esc(s.name)}</b><p class="mu">Conduct, attitude and interest are in the Conduct page. Attendance is in the Attendance page.</p>
    <label class="l1">Class teacher's remarks (leave empty to write it from the average)</label><textarea data-k="tr" rows="2" onchange="sb.mv(this)">${esc(M.tr)}</textarea>
    <select onchange="sb.pk(this.value)"><option value="">— pick a ready-made remark —</option>${LST("tr").map(x => `<option>${esc(x)}</option>`).join("")}</select>
    <label class="l1">Head teacher's remarks</label><textarea data-k="hr" rows="2" onchange="sb.mv(this)">${esc(M.hr)}</textarea>
    ${inp("Promoted to (optional, usually Term 3)", "promo", M.promo)}${inp("Arrears for next term bill (GH₵)", "arr", M.arr, 'type="number" inputmode="decimal"')}
    <label class="l1">Student photo (optional)</label><input type="file" accept="image/*" onchange="sb.ph(this)">${s.photo ? '<button class="r sm" onclick="sb.noPh()">Remove photo</button>' : ""}</div>
    <div class="fm"><b>Whole class: ${esc(X.cls)}, ${esc(X.term)}</b>${inp("Days school opened (empty = counted from attendance)", "opened", C.opened, 'type="number" inputmode="numeric"', 1)}${inp("Next term begins (Open date)", "reopen", C.reopen, "", 1)}${inp("Vacation date (Vac date)", "vacate", C.vacate, "", 1)}
    ${inp("Tuition for next term (GH₵)", "tui", C.tui, 'type="number" inputmode="decimal"', 1)}${inp("P.T.A (GH₵)", "pta", C.pta, 'type="number" inputmode="decimal"', 1)}${inp("Toiletries (GH₵)", "toi", C.toi, 'type="number" inputmode="decimal"', 1)}</div>${sigBox()}`; shFit(mn);
  }
  sb.rp = v => { X.rp = v; unf(); S.page === "mock" ? drawMock() : rcv(); };
  const refresh = () => { if (S.page === "mock") return drawMock(); const e = $("#sb_pv"); if (e) { e.innerHTML = card(packFor(X.rp)); shFit(e); } };
  sb.mv = async el => { const cl = el.dataset.c === "1"; await saveMeta(cl ? null : X.rp, { [el.dataset.k]: el.value }); refresh(); };
  sb.pk = async v => { if (v) { await saveMeta(X.rp, { tr: v }); rcv(); } };
  sb.ph = async inp => { if (!inp.files[0]) return; try { await saveMeta(X.rp, { ph: await shrink(inp.files[0], 140, .7) }); rcv(); } catch (e) { toast("Could not read that image"); } };
  sb.noPh = async () => { await saveMeta(X.rp, { ph: "" }); rcv(); };
  const sigBox = () => !isHead() ? "" : `<div class="fm"><b>Head teacher's signature (all report cards and mock slips)</b><p class="mu">Sign on white paper, take a clear photo and choose it here. It is saved once for the whole school.</p>${sc().signature ? `<img class="sb-sig" src="${esc(sc().signature)}" alt="" style="max-height:60px;display:block">` : ""}<input type="file" accept="image/*" onchange="sb.sig(this)">${sc().signature ? '<button class="r sm" onclick="sb.noSig()">Remove signature</button>' : ""}</div>`;
  async function putSig(v) { try { await api("/sba/settings", "POST", { signature: v }); S.school.signature = v; D.signature = v; toast("Saved ✅"); S.page === "mock" ? drawMock() : rcv(); } catch (e) { toast(e.message); } }
  sb.sig = async inp => { if (inp.files[0]) try { putSig(await shrink(inp.files[0], 380, .8)); } catch (e) { toast("Could not read that image"); } };
  sb.noSig = () => putSig("");
  function shrink(file, w, q) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const i = new Image(); i.onload = () => { const k = Math.min(1, w / i.width), c = document.createElement("canvas"); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", q)); }; i.onerror = rej; i.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); });
  }

  /* ---------- print / save as PDF (one file, ZIP, or separate files) ---------- */
  function printCards(list, land) {
    let st = $("#sbps"); if (!st) { st = document.createElement("style"); st.id = "sbps"; document.head.appendChild(st); }
    st.textContent = "@page{size:A4 " + (land ? "landscape" : "portrait") + ";margin:" + (land ? "8mm" : "6mm") + "}";
    openModal(list.map(h => `<div class="${land ? "pgs" : "pgc sheetbox"}">${h}</div>`).join("") + '<div class="noprint"><button onclick="window.print()">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>');
    if (!land) shFit($("#modal"));
    setTimeout(() => window.print(), 350);
  }
  let PM = [], PK = "terminal";
  sb.pc = (all, type) => {
    PK = type;
    const l = all ? D.students : D.students.filter(s => s._id === X.rp), f = type === "terminal" ? card : mcard;
    PM = l.map(s => ({ name: s.name, html: f(packFor(s._id, type)) }));
    if (!PM.length) return toast("No students in this class yet");
    const n = PM.length;
    let el = $("#sbpm"); if (!el) { el = document.createElement("div"); el.id = "sbpm"; el.hidden = true; document.body.appendChild(el); }
    el.innerHTML = `<div class="sbsh"><b>${all ? "All " + n + " " + (type === "terminal" ? "report cards" : "mock slips") : esc(PM[0].name)}</b><p class="mu">Choose what to do. Saved files go to your Downloads folder.</p><button onclick="sb.go('print')">🖨 Print now</button>
      ${all && n > 1 ? `<button class="y" onclick="sb.go('one')">📄 One PDF, all together</button><button class="y" onclick="sb.go('zip')">🗂 Separate PDFs inside one ZIP file</button><button class="y" onclick="sb.go('each')">📑 Separate PDFs, downloaded one by one</button>` : `<button class="y" onclick="sb.go('one')">📄 Save as PDF</button>`}<button class="r" onclick="sb.x()">Cancel</button></div>`;
    el.hidden = false;
  };
  sb.x = () => { const e = $("#sbpm"); if (e) e.hidden = true; };
  const LP = {}, loadJS = u => LP[u] || (LP[u] = new Promise((res, rej) => { const e = document.createElement("script"); e.src = u; e.onload = res; e.onerror = () => { delete LP[u]; rej(new Error("load")); }; document.head.appendChild(e); }));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fnm = x => String(x).replace(/[\\\/:*?"<>|]+/g, "").trim().replace(/\s+/g, "_") || "student";
  async function cardCanvas(html) {
    const h = document.createElement("div"); h.className = "pdfx"; h.innerHTML = html; document.body.appendChild(h);
    const c0 = h.firstElementChild; if (c0) fitCard(c0);
    try {
      h.querySelectorAll("svg rect").forEach(r => { const f = getComputedStyle(r).fill; r.removeAttribute("style"); r.setAttribute("fill", f); });
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await sleep(80);
      return await window.html2canvas(h, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, scrollX: 0, scrollY: 0, windowWidth: 794, windowHeight: 1400 });
    } finally { h.remove(); }
  }
  function addCanvas(pdf, cv, first) {
    if (!first) pdf.addPage();
    const pw = 210, ph = 297, m = 6, mw = pw - 2 * m, mh = ph - 2 * m; let w = mw, h = cv.height * w / cv.width; if (h > mh) { h = mh; w = cv.width * h / cv.height; }
    pdf.addImage(cv.toDataURL("image/jpeg", .92), "JPEG", (pw - w) / 2, m, w, h);
  }
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); }
  sb.go = async mode => {
    const it = PM; sb.x(); if (!it.length) return;
    if (mode === "print") return printCards(it.map(i => i.html), false);
    const base = (X.cls + "_" + X.yr + "_" + X.term + (PK === "terminal" ? "" : "_" + PK)).replace(/[^\w-]+/g, "_");
    try {
      busy(true); toast("Getting ready…");
      await Promise.all([loadJS("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"), loadJS("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"), mode === "zip" ? loadJS("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js") : 0]);
      const J = window.jspdf.jsPDF, newPdf = () => new J({ unit: "mm", format: "a4", orientation: "portrait" });
      const one = mode === "one" ? newPdf() : null, z = mode === "zip" ? new window.JSZip() : null, used = new Set();
      for (let i = 0; i < it.length; i++) {
        toast("Making PDF " + (i + 1) + " of " + it.length + "…");
        const cv = await cardCanvas(it[i].html);
        let fn = fnm(it[i].name); if (used.has(fn)) fn += "_" + (i + 1); used.add(fn);
        if (one) addCanvas(one, cv, i === 0);
        else { const p = newPdf(); addCanvas(p, cv, true); const b = p.output("blob"); if (z) z.file(fn + ".pdf", b); else { dl(b, fn + ".pdf"); await sleep(900); } }
        await sleep(20);
      }
      if (one) dl(one.output("blob"), (it.length === 1 ? fnm(it[0].name) : base) + ".pdf");
      if (z) { toast("Making the ZIP…"); dl(await z.generateAsync({ type: "blob" }), base + ".zip"); }
      toast("Done ✅ Check your Downloads folder");
    } catch (e) { toast("Could not make the PDF. Check your internet and try again."); }
    busy(false);
  };

  /* ---------- analysis sheets (terminal) ---------- */
  function anTable(rows, p, l, j) {
    const e6 = "<td></td>".repeat(6);
    return `<table class="t"><thead><tr><th class="pn" rowspan="2">Student</th>${p.map(x => `<th colspan="6">${esc(x)}</th>`).join("")}${l ? `<th colspan="${j ? 4 : 3}">OVERALL</th>` : ""}</tr><tr>${p.map(() => "<th>Class<br>/50</th><th>Exam<br>/50</th><th>Total</th><th>Pos</th><th>Grd</th><th>Remark</th>").join("")}${l ? `<th>Total</th><th>Avg</th>${j ? "<th>Agg</th>" : ""}<th>Pos</th>` : ""}</tr></thead><tbody>`
      + rows.map(o => `<tr><td class="pn">${esc(o.s.name)}</td>${p.map(x => { const y = o.sub[x]; return y ? `<td>${y.c}</td><td>${y.e}</td><td class="sbv">${y.t}</td><td>${SBC.ord(y.p)}</td><td><b>${y.g}</b></td><td class="sbr">${y.m}</td>` : e6; }).join("")}${l ? `<td class="sbv">${o.n ? o.gt : ""}</td><td>${o.n ? o.avg : ""}</td>${j ? `<td class="sbv">${o.ag ?? ""}</td>` : ""}<td class="sbv">${o.pos ? SBC.ord(o.pos) : ""}</td>` : ""}</tr>`).join("") + "</tbody></table>";
  }
  PS.analysis = async m => {
    await ensure();
    const ss = D.subjects, rows = SBC.calc(ss, D.students, reps("terminal"), X.cls), j = SBC.jhs(X.cls);
    m.innerHTML = `<h2>Analysis</h2>${bar()}` + (D.students.length ? `<p class="mu">${esc(X.cls)} · ${esc(X.term)} ${X.yr}. Terminal report analysis: class score, exam score, subject position, grade, remark and the overall position, all linked. Scroll sideways.</p>
      <button class="y" style="width:100%" onclick="sb.pa()">🖨 Print analysis sheet (all subjects)</button><button style="width:100%" onclick="sb.pn()">📌 Print notice-board sheet (everything on one page)</button>${thSel()}<div class="tw">${anTable(rows, ss, true, j)}</div>` : noStu());
  };
  const ttl = t => `<div class="sbph"><b>${esc(sc().name).toUpperCase()}</b><span>${t} · ${esc(X.cls)} · ${esc(X.term)} ${X.yr}</span></div>`;
  sb.pa = () => {
    const ss = D.subjects, rows = SBC.calc(ss, D.students, reps("terminal"), X.cls), j = SBC.jhs(X.cls), n = Math.ceil(ss.length / 3), pages = [];
    for (let b = 0; b < n; b++) pages.push(ttl("TERMINAL REPORT ANALYSIS") + `<p style="margin:0 0 4px;font-size:11px"><b>Part ${b + 1} of ${n}</b></p>` + anTable(rows, ss.slice(b * 3, b * 3 + 3), b === n - 1, j));
    printCards(pages, true);
  };
  function board(title, ss, rows, j, th) {
    const L = rows.slice().sort((a, b) => (a.pos || 9999) - (b.pos || 9999) || a.s.name.localeCompare(b.s.name)), N = L.length, st = SBC.mstat(rows, ss);
    const rh = Math.min(8, 150 / (N + 3)), fs = Math.max(1.9, rh * .58), sw = ((100 - 5 - 19 - 5.5 * (2 + (j ? 1 : 0))) / ss.length).toFixed(2);
    const cg = `<colgroup><col style="width:5%"><col style="width:19%">${ss.map(() => `<col style="width:${sw}%">`).join("")}<col style="width:5.5%"><col style="width:5.5%">${j ? '<col style="width:5.5%">' : ""}</colgroup>`;
    const sp = j ? 3 : 2;
    return `<div class="nb th-${themeOf(th)}" style="--rh:${rh}mm;--fs:${fs}mm"><div class="nb-h"><div class="nb-lg">${logoHTML()}</div><div class="nb-t"><div class="nb-1">${esc(sc().name).toUpperCase()}</div><div class="nb-2">${title}</div></div><div class="nb-3">${esc(X.cls)}<br>${X.yr} · ${esc(X.term)}</div></div>
<div class="nb-b"><table class="nb-tb">${cg}<thead><tr><th>POS</th><th>STUDENT</th>${ss.map(x => `<th>${esc(ab(x))}</th>`).join("")}<th>TOTAL</th><th>AVG</th>${j ? "<th>AGG</th>" : ""}</tr></thead><tbody>${L.map(o => `<tr class="${o.pos && o.pos < 4 ? "top" + o.pos : ""}"><td class="nb-p">${o.pos ? SBC.ord(o.pos) : ""}</td><td class="nb-n">${esc(o.s.name)}</td>${ss.map(x => { const y = o.sub[x]; return `<td>${y ? y.t + "<sup>" + y.g + "</sup>" : ""}</td>`; }).join("")}<td class="nb-tt">${o.n ? o.gt : ""}</td><td>${o.n ? o.avg : ""}</td>${j ? `<td class="nb-ag">${o.ag ?? ""}</td>` : ""}</tr>`).join("")}
<tr class="nb-f"><td colspan="2">HIGHEST</td>${ss.map(x => `<td>${st[x].hi}</td>`).join("")}<td colspan="${sp}"></td></tr><tr class="nb-f"><td colspan="2">CLASS AVERAGE</td>${ss.map(x => `<td>${st[x].av}</td>`).join("")}<td colspan="${sp}"></td></tr></tbody></table></div>
<div class="nb-ft"><span>${ss.map(x => ab(x) + " = " + esc(x)).join(" · ")}</span><span>Small figure = grade${j ? " · AGG = 4 core + best 2 (lower is better)" : ""} · Printed ${new Date().toLocaleDateString("en-GB")}</span></div></div>`;
  }
  sb.pn = () => printCards([board("TERMINAL REPORT ANALYSIS · NOTICE BOARD", D.subjects, SBC.calc(D.subjects, D.students, reps("terminal"), X.cls), SBC.jhs(X.cls), X.th)], true);
  function fitPv() { const o = document.querySelector(".pv"); if (!o) return; const i = o.firstElementChild; i.style.transform = "none"; const k = Math.min(1, o.clientWidth / i.offsetWidth); i.style.transformOrigin = "0 0"; i.style.transform = `scale(${k})`; o.style.height = (i.offsetHeight * k) + "px"; }
  addEventListener("resize", fitPv);

  /* ---------- mock exams (Basic 9, Mock 1 to 7) ---------- */
  PS.mock = async m => {
    await ensure();
    if (SBC.num(X.cls) !== 9) { m.innerHTML = `<h2>Mock exams</h2>${bar()}<p class="mu">Mock exams are for the final class (Basic / Grade 9). Choose that class above.</p>`; return; }
    drawMock();
  };
  const mockRows = n => SBC.calcMock(D.subjects, D.students, reps("mock" + (n || X.mk)));
  const mhead = () => `<h2>Mock exams</h2>${bar()}<div class="r2"><select onchange="sb.mn(this.value)">${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}"${n === X.mk ? " selected" : ""}>Mock ${n}</option>`).join("")}</select><select onchange="sb.mvw(this.value)"><option value="e"${X.mv === "e" ? " selected" : ""}>✏️ Enter scores</option><option value="a"${X.mv === "a" ? " selected" : ""}>🏆 Analysis sheet</option><option value="r"${X.mv === "r" ? " selected" : ""}>📄 Result slips</option></select></div>`;
  sb.mn = v => { X.mk = +v; save(); unf(); drawMock(); };
  sb.mvw = v => { X.mv = v; unf(); drawMock(); };
  function drawMock() {
    const mn = $("#main"), ss = D.subjects, st = D.students, type = "mock" + X.mk;
    if (!st.length) { mn.innerHTML = mhead() + noStu(); return; }
    if (X.mv === "e") {
      mn.innerHTML = mhead() + `<p class="mu">Basic 9 BECE mock: enter each subject out of 100. Grades 1 to 9, aggregate (4 core + best 2) and position are automatic.</p><div class="tw"><table class="t"><thead><tr><th class="pn">Student</th>${ss.map(x => `<th>${esc(ab(x))}<br>/100</th>`).join("")}<th>Total</th><th>Agg</th><th>Pos</th></tr></thead><tbody>${st.map(s => `<tr data-id="${s._id}"><td class="pn">${esc(s.name)}</td>${ss.map(x => `<td><input type="number" inputmode="numeric" min="0" max="100" data-ms="${esc(x)}" onchange="sb.ms(this)"><div class="gx"></div></td>`).join("")}<td class="sbv" data-f="t"></td><td class="sbv" data-f="a"></td><td class="sbv" data-f="p"></td></tr>`).join("")}</tbody></table></div>`;
      mockF();
    } else if (X.mv === "a") {
      mn.innerHTML = mhead() + `${thSel()}<p class="mu">Notice-board sheet for Mock ${X.mk}: all subjects, totals, aggregate and positions on one A4 landscape page, best to last.</p><button class="y" style="width:100%" onclick="sb.pm()">🖨 Print analysis sheet</button><div class="pv"><div>${board(esc(X.cls).toUpperCase() + " · MOCK " + X.mk + " EXAMINATION · ANALYSIS SHEET", ss, mockRows(), true, X.th)}</div></div>`;
      fitPv();
    } else {
      if (!st.find(s => s._id === X.rp)) X.rp = st[0]._id;
      mn.innerHTML = mhead() + `<select onchange="sb.rp(this.value)">${st.map(x => `<option value="${x._id}"${x._id === X.rp ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>${thSel()}<div class="r2"><button class="y" onclick="sb.pc(0,'${type}')">🖨 Print / save this slip</button><button onclick="sb.pc(1,'${type}')">🖨 Print / save all ${st.length}</button></div>${pubBar(type)}<div class="sheetbox">${mcard(packFor(X.rp, type), X.th)}</div>${sigBox()}`; shFit(mn);
    }
  }
  function mockF() {
    if (S.page !== "mock" || X.mv !== "e") return;
    const type = "mock" + X.mk;
    mockRows().forEach(o => {
      const tr = document.querySelector(`tr[data-id="${o.s._id}"]`); if (!tr) return;
      const r = reps(type)[o.s._id];
      tr.querySelectorAll("input").forEach(e => { const x = SBC.sj(r, e.dataset.ms), v = x ? x.score : null; if (document.activeElement !== e) e.value = v == null ? "" : v; e.nextElementSibling.textContent = o.sub[e.dataset.ms] ? "(" + o.sub[e.dataset.ms].g + ")" : ""; });
      const set = (f, v) => tr.querySelector(`[data-f="${f}"]`).textContent = v;
      set("t", o.n ? o.gt : ""); set("a", o.ag ?? ""); set("p", o.pos ? SBC.ord(o.pos) : "");
    });
  }
  sb.ms = async el => {
    const id = el.closest("tr").dataset.id, x = el.dataset.ms, t = "mock" + X.mk;
    const v = el.value === "" ? null : Math.round(Math.max(0, Math.min(100, +el.value))); if (v !== null && v != +el.value) el.value = v;
    ent(rpt(t, id), x).score = v == null ? undefined : v; mockF();
    try { await api("/sba/score", "POST", Object.assign(body(), { type: t, studentId: id, subject: x, raw: [v] })); } catch (er) { toast("Not saved: " + er.message); }
  };
  sb.pm = () => printCards([board(esc(X.cls).toUpperCase() + " · MOCK " + X.mk + " EXAMINATION · ANALYSIS SHEET", D.subjects, mockRows(), true, X.th)], true);

  /* ---------- parents see the published cards ---------- */
  PP.reports = async m => {
    const d = await api("/sba/mine");
    window.SBP = d.packs; S.school.signature = d.signature;
    m.innerHTML = "<h2>Report cards</h2>" + (d.packs.length ? d.packs.map((p, i) => `<div class="c"><div class="g1"><b>${esc(p.s.name)}</b><div class="mu">${esc(p.term)} ${esc(p.year)} · ${p.n ? "Mock " + p.n + " exam" : "Terminal report"} · ${esc(p.cls)}</div>
      <div class="mu">Total ${p.o.gt} · Average ${p.o.avg}${p.o.pos ? " · Position " + SBC.ord(p.o.pos) + " of " + p.onRoll : ""}</div></div><button class="sm" onclick="sb.pv(${i})">View</button></div>`).join("")
      : '<p class="mu">No report cards have been published yet. You will see them here when the school releases them.</p>');
  };
  sb.pv = i => { const p = SBP[i]; openModal(`<div class="sheetbox">${p.n ? mcard(p) : card(p)}</div><div class="noprint"><button onclick="sb.prp(${i})">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>`); shFit($("#modal")); };
  sb.prp = i => { const p = SBP[i]; printCards([p.n ? mcard(p) : card(p)], false); };

  /* ---------- small extras on the pages the school app already had ---------- */
  const _st = PS.students;
  PS.students = async m => {
    await _st(m);
    m.insertAdjacentHTML("beforeend", `<div class="fm"><b>Add many students to ${esc(S.cls)}</b><p class="mu">One full name per line.</p><textarea id="sb_nm" rows="5" placeholder="Ama Mensah&#10;Kofi Boateng"></textarea><button class="y" onclick="sb.bulk()">+ Add students</button></div>`);
  };
  sb.bulk = async () => {
    const names = $("#sb_nm").value.split("\n").map(x => x.trim()).filter(Boolean); if (!names.length) return;
    busy(true);
    try { const j = await api("/sba/pupils", "POST", { className: S.cls, names }); toast(j.added + " students added ✅"); go("students"); } catch (e) { toast(e.message); }
    busy(false);
  };
  const _set = PS.settings;
  PS.settings = async m => {
    await _set(m);
    const p = $("#st_ph");
    if (p) p.insertAdjacentHTML("afterend", `<label class="l1">Email (on report cards)</label><input id="st_em" value="${esc(S.school.email || "")}"><label class="l1">Website (on report cards)</label><input id="st_wb" value="${esc(S.school.website || "")}">`);
    const sbj = $("#st_sb");
    if (sbj) sbj.insertAdjacentHTML("beforebegin", '<p class="mu">Start a line with <b>jhs:</b> for a subject only Basic/Grade 7 to 9 take (example <b>jhs:Career Technology</b>), or <b>pri:</b> for Basic/Grade 1 to 6 only. English, Mathematics, Science and Social Studies are the 4 core subjects for the aggregate.</p>');
  };
  const _sv = window.saveSettings;
  window.saveSettings = async () => {
    const e = $("#st_em"), w = $("#st_wb");
    if (e) { try { await api("/school/mine", "PUT", { email: e.value.trim(), website: w.value.trim() }); } catch (x) { } }
    return _sv();
  };

  /* ---------- menu: put the SBA pages next to the ones the school already had ---------- */
  const add = (role, after, items) => { const a = MENU[role], i = a.findIndex(x => x[0] === after); a.splice(i + 1, 0, ...items); };
  ["teacher", "head", "owner"].forEach(r => { add(r, "scores", [["attendance", "📅", "Attendance"], ["conduct", "🎭", "Conduct"]]); add(r, "reports", [["analysis", "🏆", "Analysis"], ["mock", "🎯", "Mock Exams"]]); });
  ["head", "owner"].forEach(r => add(r, "home", [["overview", "📊", "SBA Overview"]]));

  /* ---------- install button + online light ---------- */
  let dip = null;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); dip = e; const b = $("#sb_ib"); if (b) b.hidden = false; });
  addEventListener("appinstalled", () => { dip = null; const b = $("#sb_ib"); if (b) b.hidden = true; });
  sb.inst = async () => { if (!dip) return; dip.prompt(); await dip.userChoice; dip = null; $("#sb_ib").hidden = true; };
  const net = () => { const d = $("#sb_dot"); if (d) d.classList.toggle("on", navigator.onLine); };
  const hd = document.querySelector("header");
  if (hd) hd.insertAdjacentHTML("beforeend", '<i class="dot" id="sb_dot"></i><button id="sb_ib" hidden onclick="sb.inst()">⬇ Install</button>');
  addEventListener("online", net); addEventListener("offline", net); net();
})();