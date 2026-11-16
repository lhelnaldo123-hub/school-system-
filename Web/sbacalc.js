/* sbacalc.js - grades, positions and report-card data.
   The SAME file goes in Web/ and in Server/utils/ (do not change it in only one place). */
const SBC = (function () {
  const num = c => { const m = String(c || "").match(/\d+/); return m ? +m[0] : 0; };
  const jhs = c => num(c) >= 7;                       // Basic/Grade 7, 8, 9 = JHS
  const MX = [20, 20, 20, 10, 10, 100];               // test1, test2, test3, project, group, exam
  const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
  const id = s => String(s._id);
  // subject lines in School Settings can start with "jhs:" (JHS only) or "pri:" (primary only)
  const subs = (all, c) => (all || []).filter(x => !/^(jhs|pri):/i.test(x) || (/^jhs:/i.test(x) ? jhs(c) : !jhs(c))).map(x => x.replace(/^(jhs|pri):\s*/i, ""));
  function gr(t, j) {
    if (j) { const a = [[80, 1], [70, 2], [60, 3], [55, 4], [50, 5], [45, 6], [40, 7], [35, 8], [0, 9]].find(x => t >= x[0]); return [a[1], ["", "Highest", "Higher", "High", "High Average", "Average", "Low Average", "Low", "Lower", "Lowest"][a[1]]]; }
    const a = [[90, "A+", "Excellent"], [80, "A", "Very Good"], [70, "B", "Good"], [60, "C", "Satisfactory"], [50, "D", "Fair"], [40, "E", "Weak"], [0, "F", "Needs Improvement"]].find(x => t >= x[0]); return [a[1], a[2]];
  }
  // one subject entry -> class /50, exam /50, total. Uses the 6 SBA boxes; old class/exam scores still work.
  function cs(e) {
    if (!e) return null;
    const a = e.raw;
    if (a && a.some(v => v != null)) { const m = a.slice(0, 5).reduce((x, v) => x + (+v || 0), 0), c = Math.round(m / 80 * 50), x = Math.round((+a[5] || 0) * .5); return { c, e: x, t: c + x }; }
    if (e.classScore != null || e.examScore != null) { const c = +e.classScore || 0, x = +e.examScore || 0; return { c, e: x, t: c + x }; }
    return null;
  }
  const rank = v => { const s = v.filter(x => x != null).sort((a, b) => b - a); return v.map(x => x == null ? "" : s.indexOf(x) + 1); };
  const sj = (r, x) => r && (r.subjects || []).find(s => s.name === x);
  const CORE = [/english/i, /math/i, /science/i, /social/i];
  function agg(sub, ss) {
    const names = CORE.map(r => ss.find(x => r.test(x)));
    if (names.some(x => !x) || new Set(names).size < 4) return null;
    if (names.some(x => !sub[x])) return null;
    const b = ss.filter(x => !names.includes(x) && sub[x]).map(x => sub[x].g).sort((p, q) => p - q).slice(0, 2);
    return b.length === 2 ? names.reduce((s, x) => s + sub[x].g, 0) + b[0] + b[1] : null;
  }
  function order(rows, j) {
    const rk = rows.filter(o => o.n).sort((a, b) => j ? ((a.ag ?? 99) - (b.ag ?? 99)) || b.gt - a.gt : b.gt - a.gt);
    rows.forEach(o => o.pos = o.n ? rk.findIndex(x => x.gt === o.gt && x.ag === o.ag) + 1 : "");
  }
  // terminal results of a whole class. reps = { studentId: report }
  function calc(ss, stu, reps, cls) {
    const j = jhs(cls), rows = stu.map(s => ({ s, sub: {}, gt: 0, n: 0 }));
    ss.forEach(x => {
      const r = rows.map(o => cs(sj(reps[id(o.s)], x))), p = rank(r.map(y => y && y.t));
      rows.forEach((o, i) => { const y = r[i]; if (y) { const g = gr(y.t, j); o.sub[x] = { c: y.c, e: y.e, t: y.t, g: g[0], m: g[1], p: p[i] }; o.gt += y.t; o.n++; } });
    });
    rows.forEach(o => { o.avg = o.n ? Math.round(o.gt / o.n) : 0; o.ag = j ? agg(o.sub, ss) : null; });
    order(rows, j); return rows;
  }
  // mock results (each subject out of 100, grades 1-9, aggregate)
  function calcMock(ss, stu, reps) {
    const rows = stu.map(s => ({ s, sub: {}, gt: 0, n: 0 }));
    ss.forEach(x => {
      const vs = rows.map(o => { const e = sj(reps[id(o.s)], x); return e && e.score != null ? +e.score : null; }), p = rank(vs);
      rows.forEach((o, i) => { const t = vs[i]; if (t != null) { const g = gr(t, true); o.sub[x] = { t, g: g[0], m: g[1], p: p[i] }; o.gt += t; o.n++; } });
    });
    rows.forEach(o => { o.ag = agg(o.sub, ss); o.avg = o.n ? Math.round(o.gt / o.n) : 0; });
    order(rows, true); return rows;
  }
  function mstat(rows, ss) {
    const o = {}; ss.forEach(x => { const v = rows.filter(r => r.sub[x]).map(r => r.sub[x].t); o[x] = { hi: v.length ? Math.max(...v) : "", av: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : "" }; });
    return o;
  }
  // everything one report card needs. D = { className, term, year, subjects, students, reports:{type:{studentId:report}}, att, meta }
  function pack(D, s, type) {
    const ss = D.subjects, cls = D.className, sid = id(s), mock = type !== "terminal", n = mock ? (+String(type).replace(/\D/g, "") || 1) : 0;
    const rows = mock ? calcMock(ss, D.students, D.reports[type] || {}) : calc(ss, D.students, D.reports.terminal || {}, cls);
    const find = R => R.find(r => id(r.s) === sid);
    const o = find(rows); if (!o) return null;
    const M = ((D.meta || {}).students || {})[sid] || {}, C = (D.meta || {}).cls || {}, att = D.att || {}, days = Object.keys(att).length;
    const hasD = M.days !== undefined && M.days !== null && M.days !== "";
    const p = { s: { name: s.name, photo: s.photo || "" }, cls, term: D.term, year: D.year, type, n, onRoll: D.students.length, o, M, C, hasD,
      present: hasD ? +M.days : Object.values(att).filter(d => d[sid] === "P").length, opened: +C.opened || days };
    if (mock) { p.st = mstat(rows, ss); p.prev = n > 1 ? find(calcMock(ss, D.students, D.reports["mock" + (n - 1)] || {})) : null; }
    return p;
  }
  return { num, jhs, MX, ord, subs, gr, cs, rank, sj, agg, calc, calcMock, mstat, pack };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SBC;