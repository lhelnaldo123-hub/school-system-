/* daily.js - the head teacher's / administrator's daily report.
   Written by hand each day (attendance per class, fees collected today), and printed. */
(function () {
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const long = d => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const gh = n => "GH₵" + (+n || 0).toFixed(2);
  const n0 = v => { const n = Math.round(parseFloat(v)); return isFinite(n) && n > 0 ? n : 0; };
  const n2 = v => { const n = parseFloat(v); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
  const val = id => { const e = document.getElementById(id); return e ? e.value : ""; };
  const dr = window.dr = {};
  let DR = null, date = "", main = null, recent = [];
  const exRow = (x) => `<div class="r2 dr-er" style="margin-top:6px"><input class="dr-ei" placeholder="What for (e.g. chalk, water)" value="${esc(x.item || "")}" style="flex:2"><input class="dr-ea" type="number" inputmode="decimal" min="0" placeholder="GH₵" value="${x.amount || ""}" onchange="dr.tot()"></div>`;

  PS.daily = async m => {
    main = m; date = date || today();
    DR = await api("/daily?date=" + date);
    try { recent = await api("/daily/recent"); } catch (e) { recent = []; }
    draw();
  };

  function draw() {
    const cl = (S.school && S.school.classes) || [];
    const saved = (DR.report && DR.report.classes) || [], f = (DR.report && DR.report.fees) || {};
    const rows = cl.map((c, i) => {
      const s = saved.find(x => x.className === c) || {};
      const roll = s.onRoll != null ? s.onRoll : (DR.roll[c] || 0);
      return `<div class="fm"><b>${esc(c)}</b>
        <div class="r2"><div><label class="l1">On roll</label><input type="number" inputmode="numeric" min="0" id="dr_r${i}" value="${roll}" onchange="dr.pre(${i})"></div>
        <div><label class="l1">Present</label><input type="number" inputmode="numeric" min="0" id="dr_p${i}" value="${s.present != null ? s.present : ""}" onchange="dr.pre(${i})"></div>
        <div><label class="l1">Absent</label><input type="number" inputmode="numeric" min="0" id="dr_a${i}" value="${s.absent != null ? s.absent : ""}" onchange="dr.tot()"></div></div>
        <input id="dr_n${i}" placeholder="Names of absentees (optional)" value="${esc(s.names || "")}"></div>`;
    }).join("");
    const sys = DR.system || {}, sysTot = (sys.school || 0) + (sys.feeding || 0) + (sys.exam || 0) + (sys.other || 0);
    main.innerHTML = `<h2>Daily Report</h2>
      <div class="fm"><label class="l1">Date</label><input type="date" value="${date}" onchange="dr.day(this.value)">
      <p class="mu" style="margin-bottom:0">${DR.report ? "✅ A report is saved for this day. You can change it and save again." : "No report saved for this day yet."}</p></div>
      ${recent.length ? `<div class="fm"><b>Recent days</b><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${recent.map(r => `<button class="sm${r.date === date ? " y" : " g"}" onclick="dr.day('${r.date}')">${r.date.slice(5)}</button>`).join("")}</div></div>` : ""}
      <h3>1. Attendance by class</h3>
      <p class="mu">Type how many are present. Absent fills in by itself (you can change it).</p>${rows}
      <div class="fm"><b id="dr_tt"></b></div>
      <h3>2. Fees collected today</h3>
      <div class="fm">
        <label class="l1">School fees (GH₵)</label><input type="number" inputmode="decimal" min="0" id="dr_fs" value="${f.school || ""}" onchange="dr.tot()">
        <label class="l1">Feeding fee (GH₵)</label><input type="number" inputmode="decimal" min="0" id="dr_ff" value="${f.feeding || ""}" onchange="dr.tot()">
        <label class="l1">Exam fees (GH₵)</label><input type="number" inputmode="decimal" min="0" id="dr_fe" value="${f.exam || ""}" onchange="dr.tot()">
        <label class="l1">Other (GH₵)</label><input type="number" inputmode="decimal" min="0" id="dr_fo" value="${f.other || ""}" onchange="dr.tot()">
        <p style="margin:8px 0 0"><b id="dr_ft"></b></p>
        ${sysTot > 0 ? `<button class="sm g" onclick="dr.fill()">Copy what the app recorded today (${gh(sysTot)})</button>` : '<p class="mu" style="margin-bottom:0">Nothing was recorded in the app on this day. Write the amounts yourself.</p>'}
      </div>
      <h3>3. Money spent today</h3>
      <div class="fm"><div id="dr_ex">${((DR.report && DR.report.expenses) || []).concat([{}, {}]).map(exRow).join("")}</div>
        <button class="sm g" style="margin-top:8px" onclick="dr.addEx()">+ Add another</button>
        <p style="margin:8px 0 0"><b id="dr_et"></b></p></div>
      <h3>4. Notes</h3>
      <div class="fm"><textarea id="dr_nt" rows="4" placeholder="Anything important about the day: visitors, problems, absent teachers, events...">${esc(DR.report ? DR.report.notes : "")}</textarea></div>
      <div class="r2"><button class="y" onclick="dr.save()">💾 Save report</button><button onclick="dr.print()">🖨 Print</button></div>`;
    dr.tot();
  }

  const grab = () => {
    const cl = (S.school && S.school.classes) || [];
    return {
      date,
      classes: cl.map((c, i) => ({ className: c, onRoll: n0(val("dr_r" + i)), present: n0(val("dr_p" + i)), absent: n0(val("dr_a" + i)), names: val("dr_n" + i).trim() })),
      fees: { school: n2(val("dr_fs")), feeding: n2(val("dr_ff")), exam: n2(val("dr_fe")), other: n2(val("dr_fo")) },
      expenses: [...document.querySelectorAll(".dr-er")].map(r => ({ item: r.querySelector(".dr-ei").value.trim(), amount: n2(r.querySelector(".dr-ea").value) })).filter(x => x.item || x.amount),
      notes: val("dr_nt").trim()
    };
  };

  dr.pre = i => {
    const r = n0(val("dr_r" + i)), p = val("dr_p" + i);
    if (p !== "") document.getElementById("dr_a" + i).value = Math.max(0, r - n0(p));
    dr.tot();
  };
  dr.tot = () => {
    const g = grab(), t = g.classes.reduce((a, c) => ({ r: a.r + c.onRoll, p: a.p + c.present, a: a.a + c.absent }), { r: 0, p: 0, a: 0 });
    const e = document.getElementById("dr_tt"); if (e) e.textContent = `Whole school: ${t.r} on roll · ${t.p} present · ${t.a} absent`;
    const f = g.fees, col = f.school + f.feeding + f.exam + f.other, sp = g.expenses.reduce((a, x) => a + x.amount, 0);
    const ft = document.getElementById("dr_ft"); if (ft) ft.textContent = "Total collected today: " + gh(col);
    const et = document.getElementById("dr_et"); if (et) et.textContent = "Total spent: " + gh(sp) + " · Balance (collected − spent): " + gh(col - sp);
  };
  dr.addEx = () => { document.getElementById("dr_ex").insertAdjacentHTML("beforeend", exRow({})); };
  dr.fill = () => {
    const s = DR.system || {};
    [["fs", "school"], ["ff", "feeding"], ["fe", "exam"], ["fo", "other"]].forEach(x => { document.getElementById("dr_" + x[0]).value = s[x[1]] || ""; });
    dr.tot(); toast("Copied. Add anything collected outside the app, then save.");
  };
  dr.day = async d => { if (!d) return; date = d; try { await PS.daily(main); } catch (e) { toast(e.message); } };
  dr.save = async () => {
    busy(true);
    try { await api("/daily", "POST", grab()); toast("Daily report saved ✅"); DR = await api("/daily?date=" + date); try { recent = await api("/daily/recent"); } catch (e) { } draw(); }
    catch (e) { toast("Not saved: " + e.message); }
    busy(false);
  };
  dr.print = () => {
    const g = grab(), s = S.school || {}, f = g.fees, ft = f.school + f.feeding + f.exam + f.other, sp = g.expenses.reduce((a, x) => a + x.amount, 0);
    const t = g.classes.reduce((a, c) => ({ r: a.r + c.onRoll, p: a.p + c.present, a: a.a + c.absent }), { r: 0, p: 0, a: 0 });
    const body = g.classes.filter(c => c.onRoll || c.present || c.absent).map(c => `<tr><td>${esc(c.className)}</td><td class="n">${c.onRoll}</td><td class="n">${c.present}</td><td class="n">${c.absent}</td><td>${esc(c.names)}</td></tr>`).join("");
    let st = document.getElementById("sbps"); if (!st) { st = document.createElement("style"); st.id = "sbps"; document.head.appendChild(st); }
    st.textContent = "@page{size:A4 portrait;margin:10mm}";
    openModal(`<style>.drp{font-family:Arial,sans-serif;color:#111;font-size:13px;background:#fff;padding:10px}.drp h2,.drp h3{margin:2px 0;text-align:center}.drp .sub{text-align:center;color:#444;margin-bottom:6px}
      .drt{border-collapse:collapse;width:100%;margin:8px 0}.drt th,.drt td{border:1px solid #333;padding:4px 6px;text-align:left}.drt th{background:#eee}.drt .n{text-align:center;width:60px}.drt tfoot td{font-weight:bold;background:#f5f5f5}
      .drsig{display:flex;gap:20px;margin-top:34px}.drsig div{flex:1;border-top:1px solid #333;padding-top:4px;text-align:center;font-size:12px}</style>
      <div class="drp"><h2>${esc(s.name || "")}</h2><div class="sub">${esc([s.address, s.phone].filter(Boolean).join(" · "))}</div>
      <h3>DAILY REPORT</h3><div class="sub"><b>${esc(long(date))}</b></div>
      <b>Attendance</b>
      <table class="drt"><thead><tr><th>Class</th><th class="n">On roll</th><th class="n">Present</th><th class="n">Absent</th><th>Absentees</th></tr></thead><tbody>${body || '<tr><td colspan="5">No attendance written</td></tr>'}</tbody>
      <tfoot><tr><td>TOTAL</td><td class="n">${t.r}</td><td class="n">${t.p}</td><td class="n">${t.a}</td><td></td></tr></tfoot></table>
      <b>Fees collected today</b>
      <table class="drt"><tbody><tr><td>School fees</td><td>${gh(f.school)}</td></tr><tr><td>Feeding fee</td><td>${gh(f.feeding)}</td></tr><tr><td>Exam fees</td><td>${gh(f.exam)}</td></tr><tr><td>Other</td><td>${gh(f.other)}</td></tr></tbody>
      <tfoot><tr><td>TOTAL COLLECTED</td><td>${gh(ft)}</td></tr></tfoot></table>
      ${g.expenses.length ? `<b>Money spent today</b><table class="drt"><tbody>${g.expenses.map(x => `<tr><td>${esc(x.item)}</td><td>${gh(x.amount)}</td></tr>`).join("")}</tbody><tfoot><tr><td>TOTAL SPENT</td><td>${gh(sp)}</td></tr></tfoot></table>` : ""}
      <table class="drt"><tbody><tr><td><b>BALANCE (collected − spent)</b></td><td><b>${gh(ft - sp)}</b></td></tr></tbody></table>
      ${g.notes ? `<b>Notes</b><p style="white-space:pre-wrap;margin:4px 0">${esc(g.notes)}</p>` : ""}
      <div class="drsig"><div>Prepared by: ${esc(S.user.name)}</div><div>Head teacher's signature</div></div></div>`
      + '<div class="noprint"><button onclick="window.print()">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>');
    setTimeout(() => window.print(), 350);
  };

  /* menu: put "Daily Report" under "Who owes" for the head teacher and the owner */
  ["head", "owner"].forEach(r => {
    const a = MENU[r], i = a.findIndex(x => x[0] === "owing");
    if (!a.some(x => x[0] === "daily")) a.splice(i + 1, 0, ["daily", "📋", "Daily Report"]);
  });
})();
