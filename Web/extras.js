/* extras.js - Monthly Report, Fee Summary, Teacher Attendance, Pupil Profile, Send Notice (WhatsApp) and Backup.
   Loads after daily-report.js and adds its pages to the menu. */
(function () {
  const ex = window.ex = {};
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const gh = n => "GH₵" + (+n || 0).toFixed(2);
  const long = d => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const monthName = m => new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const sum = (a, f) => a.reduce((t, x) => t + (+f(x) || 0), 0);

  /* ---- shared look for these pages and their printouts ---- */
  const st = document.createElement("style");
  st.textContent = `.exr{font-family:Arial,sans-serif;color:#111;font-size:13px}.exr table{border-collapse:collapse;width:100%;margin:8px 0;background:#fff}
    .exr th,.exr td{border:1px solid #333;padding:4px 6px;text-align:left}.exr th{background:#eee}.exr .n{text-align:center}.exr tfoot td{font-weight:bold;background:#f5f5f5}
    .exr h2,.exr h3{text-align:center;margin:3px 0}.exr h4{margin:10px 0 2px}.exr .sub{text-align:center;color:#444}.exr .bx{overflow-x:auto}
    .exsig{display:flex;gap:20px;margin-top:34px}.exsig div{flex:1;border-top:1px solid #333;padding-top:4px;text-align:center;font-size:12px}`;
  document.head.appendChild(st);

  const head = (title, sub) => { const s = S.school || {}; return `<h2>${esc(s.name || "")}</h2><div class="sub">${esc([s.address, s.phone].filter(Boolean).join(" · "))}</div><h3>${title}</h3>${sub ? `<div class="sub"><b>${sub}</b></div>` : ""}`; };
  const sig = () => `<div class="exsig"><div>Prepared by: ${esc(S.user.name)}</div><div>Head teacher's signature</div></div>`;
  function pr(html, land) {
    let s = document.getElementById("sbps"); if (!s) { s = document.createElement("style"); s.id = "sbps"; document.head.appendChild(s); }
    s.textContent = "@page{size:A4 " + (land ? "landscape" : "portrait") + ";margin:10mm}";
    openModal(`<div class="exr" style="background:#fff;padding:10px">${html}</div><div class="noprint"><button onclick="window.print()">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>`);
    setTimeout(() => window.print(), 350);
  }

  /* =========================== MONTHLY REPORT =========================== */
  let MO = localStorage.exMonth || today().slice(0, 7), MD = null;
  PS.monthly = async m => {
    const [rep, sa] = await Promise.all([api("/daily/month?month=" + MO), api("/staffatt/month?month=" + MO).catch(() => null)]);
    MD = { rep, sa };
    m.innerHTML = `<h2>Monthly Report</h2><div class="fm"><label class="l1">Month</label><input type="month" value="${MO}" onchange="ex.mo(this.value)">
      <p class="mu" style="margin-bottom:0">This adds up the daily reports you saved for the month.</p></div>`
      + (rep.length ? `<div class="r2"><button class="y" onclick="ex.pm()">🖨 Print</button></div><div class="exr">${monthHTML()}</div>` : '<p class="mu">No daily reports saved for this month yet.</p>');
  };
  ex.mo = v => { if (!v) return; MO = v; localStorage.exMonth = v; go("monthly"); };
  ex.pm = () => pr(monthHTML(), false);
  function monthHTML() {
    const rep = MD.rep, f = k => sum(rep, r => (r.fees || {})[k]);
    const fees = { school: f("school"), feeding: f("feeding"), exam: f("exam"), other: f("other") }, col = fees.school + fees.feeding + fees.exam + fees.other;
    const exp = {}; rep.forEach(r => (r.expenses || []).forEach(x => { const k = (x.item || "Other").trim().toLowerCase(); exp[k] = (exp[k] || 0) + (+x.amount || 0); }));
    const spent = sum(Object.values(exp), x => x);
    const cls = {};
    rep.forEach(r => (r.classes || []).forEach(c => {
      if (!(c.present || c.absent)) return;
      const o = cls[c.className] = cls[c.className] || { n: 0, p: 0, a: 0, roll: 0 };
      o.n++; o.p += c.present; o.a += c.absent; o.roll = c.onRoll || o.roll;
    }));
    const order = (S.school && S.school.classes) || [];
    const crow = Object.keys(cls).sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999)).map(k => {
      const o = cls[k], pct = o.p + o.a ? Math.round(o.p / (o.p + o.a) * 100) : 0;
      return `<tr><td>${esc(k)}</td><td class="n">${o.roll}</td><td class="n">${o.n}</td><td class="n">${Math.round(o.p / o.n)}</td><td class="n">${o.a}</td><td class="n">${pct}%</td></tr>`;
    }).join("");
    let staff = "";
    const sa = MD.sa;
    if (sa && sa.teachers.length && sa.days.length) {
      staff = `<h4>Teacher attendance (${sa.days.length} day(s) marked)</h4><table><thead><tr><th>Teacher</th><th class="n">Present</th><th class="n">Late</th><th class="n">Absent</th></tr></thead><tbody>`
        + sa.teachers.map(t => { const c = { P: 0, L: 0, A: 0 }; sa.days.forEach(d => { const v = (d.marks || {})[t._id]; if (c[v] !== undefined) c[v]++; }); return `<tr><td>${esc(t.name)}</td><td class="n">${c.P}</td><td class="n">${c.L}</td><td class="n">${c.A}</td></tr>`; }).join("") + "</tbody></table>";
    }
    return `${head("MONTHLY REPORT", esc(monthName(MO)))}
      <p class="sub">${rep.length} daily report(s) saved this month</p>
      <h4>Fees collected</h4><table><tbody><tr><td>School fees</td><td>${gh(fees.school)}</td></tr><tr><td>Feeding fee</td><td>${gh(fees.feeding)}</td></tr><tr><td>Exam fees</td><td>${gh(fees.exam)}</td></tr><tr><td>Other</td><td>${gh(fees.other)}</td></tr></tbody><tfoot><tr><td>TOTAL COLLECTED</td><td>${gh(col)}</td></tr></tfoot></table>
      <h4>Money spent</h4>${spent ? `<table><tbody>${Object.keys(exp).sort((a, b) => exp[b] - exp[a]).map(k => `<tr><td>${esc(k.charAt(0).toUpperCase() + k.slice(1))}</td><td>${gh(exp[k])}</td></tr>`).join("")}</tbody><tfoot><tr><td>TOTAL SPENT</td><td>${gh(spent)}</td></tr></tfoot></table>` : '<p class="sub">No expenses written.</p>'}
      <table><tbody><tr><td><b>BALANCE FOR THE MONTH (collected − spent)</b></td><td><b>${gh(col - spent)}</b></td></tr></tbody></table>
      <h4>Pupils' attendance by class</h4><div class="bx"><table><thead><tr><th>Class</th><th class="n">On roll</th><th class="n">Days written</th><th class="n">Average present</th><th class="n">Total absences</th><th class="n">Attendance</th></tr></thead><tbody>${crow || '<tr><td colspan="6">No attendance written</td></tr>'}</tbody></table></div>
      ${staff}${sig()}`;
  }

  /* =========================== FEE SUMMARY =========================== */
  let FS = null, RF = today().slice(0, 8) + "01", RT = today();
  PS.fsum = async m => {
    FS = await api("/summary/fees");
    const t = { p: sum(FS, c => c.pupils), e: sum(FS, c => c.expected), c: sum(FS, c => c.paid), o: sum(FS, c => c.owing) };
    m.innerHTML = `<h2>Fee Summary</h2><p class="mu">What each class should pay, has paid, and still owes (all fees on the system).</p>
      <div class="tw"><table class="t"><thead><tr><th>Class</th><th>Pupils</th><th>Should pay</th><th>Paid</th><th>Owing</th></tr></thead><tbody>
      ${FS.map(c => `<tr><td class="pn">${esc(c.className)}</td><td>${c.pupils}</td><td>${gh(c.expected)}</td><td>${gh(c.paid)}</td><td><b>${gh(c.owing)}</b> <small>(${c.owingPupils})</small></td></tr>`).join("")}
      <tr><td class="pn"><b>TOTAL</b></td><td><b>${t.p}</b></td><td><b>${gh(t.e)}</b></td><td><b>${gh(t.c)}</b></td><td><b>${gh(t.o)}</b></td></tr></tbody></table></div>
      <div class="r2"><button class="y" onclick="ex.pfs()">🖨 Print summary</button><button onclick="ex.pow()">🖨 Print owing list by class</button></div>
      <h3>Receipts register</h3><div class="fm"><div class="r2"><div><label class="l1">From</label><input type="date" id="rg_f" value="${RF}"></div><div><label class="l1">To</label><input type="date" id="rg_t" value="${RT}"></div></div>
      <button onclick="ex.prg()">🖨 Print receipts register</button><p class="mu" style="margin-bottom:0">Shows up to the 150 latest receipts.</p></div>`;
  };
  ex.pfs = () => {
    const t = { p: sum(FS, c => c.pupils), e: sum(FS, c => c.expected), c: sum(FS, c => c.paid), o: sum(FS, c => c.owing) };
    pr(`${head("FEE SUMMARY BY CLASS", esc(long(today())))}<table><thead><tr><th>Class</th><th class="n">Pupils</th><th>Should pay</th><th>Paid</th><th>Owing</th><th class="n">Pupils owing</th></tr></thead><tbody>
      ${FS.map(c => `<tr><td>${esc(c.className)}</td><td class="n">${c.pupils}</td><td>${gh(c.expected)}</td><td>${gh(c.paid)}</td><td>${gh(c.owing)}</td><td class="n">${c.owingPupils}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td>TOTAL</td><td class="n">${t.p}</td><td>${gh(t.e)}</td><td>${gh(t.c)}</td><td>${gh(t.o)}</td><td class="n">${sum(FS, c => c.owingPupils)}</td></tr></tfoot></table>${sig()}`);
  };
  ex.pow = async () => {
    busy(true);
    try {
      const d = await api("/fees/owing"), by = {}; d.forEach(x => (by[x.className] = by[x.className] || []).push(x));
      const order = (S.school && S.school.classes) || [];
      const html = Object.keys(by).sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999)).map(k =>
        `<h4>${esc(k)} · ${gh(sum(by[k], x => x.owed))}</h4><table><thead><tr><th>Pupil</th><th>Owes</th><th>Parent phone</th></tr></thead><tbody>${by[k].map(x => `<tr><td>${esc(x.name)}</td><td>${gh(x.owed)}</td><td>${esc((x.parents || []).map(p => p.phone).filter(Boolean).join(", "))}</td></tr>`).join("")}</tbody></table>`).join("");
      pr(`${head("PUPILS OWING FEES", esc(long(today())))}${html || '<p class="sub">Nobody owes. 🎉</p>'}<p><b>Total owing: ${gh(sum(d, x => x.owed))}</b></p>${sig()}`);
    } catch (e) { toast(e.message); }
    busy(false);
  };
  ex.prg = async () => {
    RF = val("rg_f") || RF; RT = val("rg_t") || RT;
    busy(true);
    try {
      const all = await api("/fees/receipts");
      const list = all.filter(p => { const d = new Date(p.paidAt).toISOString().slice(0, 10); return d >= RF && d <= RT; }).sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt));
      pr(`${head("RECEIPTS REGISTER", esc(RF + " to " + RT))}<table><thead><tr><th>Date</th><th>Receipt</th><th>Pupil</th><th>Class</th><th>Fee</th><th>Paid</th><th>Balance</th><th>By</th></tr></thead><tbody>
        ${list.map(p => `<tr><td>${new Date(p.paidAt).toLocaleDateString("en-GB")}</td><td>${esc(p.receiptNo)}</td><td>${esc(p.studentId && p.studentId.name)}</td><td>${esc(p.studentId && p.studentId.className)}</td><td>${esc(p.feeId && p.feeId.title)}</td><td>${gh(p.amount)}</td><td>${gh(p.balanceAfter)}</td><td>${esc(p.method || "")}</td></tr>`).join("") || '<tr><td colspan="8">No receipts in these dates</td></tr>'}</tbody>
        <tfoot><tr><td colspan="5">TOTAL (${list.length})</td><td colspan="3">${gh(sum(list, p => p.amount))}</td></tr></tfoot></table>${sig()}`, true);
    } catch (e) { toast(e.message); }
    busy(false);
  };
  const val = id => { const e = document.getElementById(id); return e ? e.value : ""; };

  /* =========================== TEACHER ATTENDANCE =========================== */
  let TD = today(), TA = null;
  PS.tatt = async m => {
    TA = await api("/staffatt?date=" + TD);
    m.innerHTML = `<h2>Teacher Attendance</h2><div class="fm"><label class="l1">Date</label><input type="date" value="${TD}" onchange="ex.td(this.value)">
      <div class="r2" style="margin-top:8px"><button class="y" onclick="ex.allT()">✔ Everyone present</button></div>
      <p class="mu" style="margin-bottom:0">It saves as soon as you choose. The monthly report adds it up.</p></div>`
      + (TA.teachers.length ? TA.teachers.map(t => `<div class="c"><div class="g1"><b>${esc(t.name)}</b></div><select data-id="${t._id}" onchange="ex.tm(this)" style="width:130px">
        ${[["", "— not marked"], ["P", "Present"], ["L", "Late"], ["A", "Absent"]].map(o => `<option value="${o[0]}"${(TA.marks[t._id] || "") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></div>`).join("")
        : '<p class="mu">No teachers yet. Add them in Parents &amp; Teachers.</p>');
  };
  ex.td = v => { if (!v) return; TD = v; go("tatt"); };
  ex.tm = async el => { try { await api("/staffatt", "POST", { date: TD, marks: { [el.dataset.id]: el.value } }); TA.marks[el.dataset.id] = el.value; toast("Saved ✅"); } catch (e) { toast("Not saved: " + e.message); } };
  ex.allT = async () => {
    const marks = {}; TA.teachers.forEach(t => { marks[t._id] = "P"; });
    try { await api("/staffatt", "POST", { date: TD, marks }); go("tatt"); } catch (e) { toast("Not saved: " + e.message); }
  };

  /* =========================== PUPIL PROFILE =========================== */
  let PL = null;
  PS.pprofile = async m => {
    PL = await api("/students");
    m.innerHTML = `<h2>Pupil Profile</h2><p class="mu">Search a pupil to see their parents, fees, attendance and results in one place.</p>
      <input placeholder="🔍 Search pupil, class or parent" oninput="filterList('#ppl',this.value)"><div id="ppl">`
      + PL.map(s => `<div class="c" style="cursor:pointer" onclick="ex.prof('${s._id}')"><div class="g1"><b>${esc(s.name)}</b> <span class="mu">${esc(s.className)}</span><div class="mu">${(s.parents || []).map(p => esc(p.name)).join(", ")}</div></div><span>›</span></div>`).join("") + "</div>";
  };
  let PD = null;
  ex.prof = async id => {
    busy(true);
    try {
      PD = await api("/summary/student/" + id);
      $("#main").innerHTML = `<button class="sm g" onclick="go('pprofile')">‹ Back to the list</button><div class="r2" style="margin-top:8px"><button class="y" onclick="ex.pp()">🖨 Print profile</button></div><div class="exr">${profHTML()}</div>`;
      window.scrollTo(0, 0);
    } catch (e) { toast(e.message); }
    busy(false);
  };
  ex.pp = () => pr(profHTML(), false);
  function profHTML() {
    const d = PD, s = d.student, a = d.attendance, tot = a.present + a.absent;
    const owe = sum(d.fees, f => f.balance);
    return `${head("PUPIL PROFILE", esc(s.name))}
      <table><tbody><tr><td>Name</td><td><b>${esc(s.name)}</b></td></tr><tr><td>Class</td><td>${esc(s.className)}</td></tr><tr><td>Gender</td><td>${esc(s.gender || "")}</td></tr>
      <tr><td>Parent(s)</td><td>${s.parents.map(p => esc(p.name) + (p.phone ? " · " + esc(p.phone) : "")).join("<br>") || "No parent linked"}</td></tr></tbody></table>
      <h4>Fees</h4>${d.fees.length ? `<table><thead><tr><th>Fee</th><th>Amount</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${d.fees.map(f => `<tr><td>${esc(f.title)}${f.carried ? " (" + esc(f.className) + ")" : ""}</td><td>${gh(f.amount)}</td><td>${gh(f.paid)}</td><td>${gh(f.balance)}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="3">TOTAL OWING</td><td>${gh(owe)}</td></tr></tfoot></table>` : '<p class="sub">No fees.</p>'}
      <h4>Payments made</h4>${d.payments.length ? `<table><thead><tr><th>Date</th><th>Fee</th><th>Amount</th><th>By</th></tr></thead><tbody>${d.payments.map(p => `<tr><td>${new Date(p.paidAt).toLocaleDateString("en-GB")}</td><td>${esc(p.title)}</td><td>${gh(p.amount)}</td><td>${esc(p.method || "")}</td></tr>`).join("")}</tbody></table>` : '<p class="sub">No payments yet.</p>'}
      <h4>Attendance in ${a.year}</h4><table><tbody><tr><td>Days present</td><td>${a.present}</td></tr><tr><td>Days absent</td><td>${a.absent}</td></tr><tr><td>Attendance</td><td>${tot ? Math.round(a.present / tot * 100) + "%" : "—"}</td></tr></tbody></table>
      <h4>Results</h4>${d.results.length ? d.results.map(r => `<table><thead><tr><th colspan="2">${esc(r.term)} ${r.year} · ${esc(r.className)} · Average ${r.average}</th></tr></thead><tbody>${r.subjects.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${x.total}</td></tr>`).join("")}</tbody></table>`).join("") : '<p class="sub">No results entered yet.</p>'}`;
  }

  /* =========================== SEND NOTICE (WhatsApp) =========================== */
  const NT = { "School closing": "Dear parent, please note that school closes on ____ and reopens on ____. Thank you.", "PTA meeting": "Dear parent, there will be a PTA meeting on ____ at ____ in the school. Your presence is important. Thank you.", "Fees reminder": "Dear parent, please remember to pay your child's school fees. You can pay through the school app. Thank you." };
  PS.notice = async m => {
    const c = await api("/announce/count?className=all");
    m.innerHTML = `<h2>Send Notice</h2>
      ${!c.whatsapp ? '<div class="fm" style="border-top-color:#c00"><b>WhatsApp is not set up yet.</b><p class="mu" style="margin-bottom:0">Add WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in Render first.</p></div>' : ""}
      ${c.whatsapp && !c.template ? '<p class="mu">Without an approved message template, WhatsApp only delivers to parents who wrote to your school number in the last 24 hours. Add WHATSAPP_TEMPLATE in Render to reach everyone.</p>' : ""}
      <div class="fm"><label class="l1">Send to</label><select id="nt_c" onchange="ex.nc()"><option value="all">All parents</option>${opts((S.school && S.school.classes) || [])}</select>
      <p class="mu" id="nt_n">${c.phones} parent phone number(s)</p>
      <label class="l1">Quick messages</label><div style="display:flex;flex-wrap:wrap;gap:6px">${Object.keys(NT).map(k => `<button class="sm g" onclick="ex.nq('${k}')">${k}</button>`).join("")}</div>
      <label class="l1">Message</label><textarea id="nt_m" rows="6" maxlength="900" placeholder="Write the notice..."></textarea>
      <button class="y" onclick="ex.ns()">💬 Send on WhatsApp</button><p class="mu" style="margin-bottom:0">It also shows in the parents' app under Notices.</p></div>
      <div class="fm" id="nt_s">${statusHTML(c.last)}</div>`;
  };
  const statusHTML = l => !l ? '<b>Last sending</b><p class="mu" style="margin-bottom:0">Nothing sent since the server last started.</p>'
    : `<b>Last sending</b><p style="margin:6px 0">${l.done ? "Finished" : "Still sending…"} · ✅ ${l.sent} sent · ❌ ${l.failed} failed · of ${l.total}</p>${l.reason ? `<p class="mu">Reason: ${esc(l.reason)}</p>` : ""}<button class="sm g" onclick="ex.nr()">Refresh</button>`;
  ex.nq = k => { $("#nt_m").value = NT[k]; };
  ex.nc = async () => { try { const c = await api("/announce/count?className=" + encodeURIComponent(val("nt_c"))); $("#nt_n").textContent = c.phones + " parent phone number(s)"; } catch (e) { toast(e.message); } };
  ex.nr = async () => { try { const c = await api("/announce/count?className=all"); $("#nt_s").innerHTML = statusHTML(c.last); } catch (e) { toast(e.message); } };
  ex.ns = async () => {
    const msg = val("nt_m").trim(); if (msg.length < 3) return toast("Write the message first");
    if (/____/.test(msg)) return toast("Fill in the blanks (____) first");
    if (!confirm("Send this to " + $("#nt_n").textContent.split(" ")[0] + " parent(s) on WhatsApp?")) return;
    busy(true);
    try { const j = await api("/announce/send", "POST", { className: val("nt_c"), message: msg }); toast("Sending to " + j.queued + " parent(s)… tap Refresh to see how it goes"); setTimeout(ex.nr, 4000); }
    catch (e) { toast(e.message); }
    busy(false);
  };

  /* =========================== BACKUP (owner) =========================== */
  PS.backup = async m => {
    m.innerHTML = `<h2>Backup</h2><div class="fm"><p>Download a copy of all your school's data: pupils, parents, teachers, fees, payments, scores, attendance, notices and daily reports.</p>
      <button class="y" onclick="ex.bk()">💾 Download backup</button>
      <p class="mu" style="margin-bottom:0">Photos, signatures, payment screenshots and passwords are not included. Keep the file safe (for example in Google Drive) and do this every month.</p></div>`;
  };
  ex.bk = async () => {
    busy(true);
    try {
      const d = await api("/backup"), b = new Blob([JSON.stringify(d)], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = "school-backup-" + today() + ".json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast("Backup downloaded ✅");
    } catch (e) { toast(e.message); }
    busy(false);
  };

  /* ---- menu ---- */
  const base = [["monthly", "📆", "Monthly Report"], ["fsum", "🧮", "Fee Summary"], ["tatt", "🧑‍🏫", "Teacher Attendance"], ["pprofile", "🪪", "Pupil Profile"], ["notice", "💬", "Send Notice"]];
  ["head", "owner"].forEach(r => {
    const a = MENU[r], items = r === "owner" ? base.concat([["backup", "💾", "Backup"]]) : base;
    let i = a.findIndex(x => x[0] === "daily"); if (i < 0) i = a.findIndex(x => x[0] === "owing");
    if (!a.some(x => x[0] === "monthly")) a.splice(i + 1, 0, ...items);
  });
})();
