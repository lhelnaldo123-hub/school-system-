// routes/sba.js - the SBA system: scores, attendance, conduct, report-card data, mock exams.
// Loaded automatically as /api/sba
const router = require("express").Router();
const Student = require("../models/Student");
const Report = require("../models/Report");
const Attendance = require("../models/Attendance");
const Meta = require("../models/TermMeta");
const School = require("../models/School");
const User = require("../models/User");
const auth = require("../middleware/auth");
const SBC = require("../utils/sbacalc");

const STAFF = ["owner", "head", "teacher"], HEAD = ["owner", "head"];
const OID = /^[a-f0-9]{24}$/;
const SK = ["cd", "at", "it", "tr", "hr", "promo", "arr", "days"];       // per-student facts
const CK = ["opened", "reopen", "vacate", "tui", "pta", "toi"];          // whole-class facts
const bad = (res, e) => res.status(400).json({ error: e.message || e });

// A teacher with classes set can only work on those classes
async function allowed(req, className) {
  if (req.user.role !== "teacher") return true;
  const u = await User.findById(req.user.id);
  return !u.classes.length || u.classes.includes(className);
}
const key = (req, b) => ({ schoolId: req.user.schoolId, className: b.className, term: b.term, year: Number(b.year) });

// Everything about one class in one term
async function bundle(sid, c) {
  const [students, reps, att, meta, sch] = await Promise.all([
    Student.find({ schoolId: sid, className: c.className, active: true }).sort({ name: 1 }).select("name photo").lean(),
    Report.find({ schoolId: sid, ...c }).lean(),
    Attendance.find({ schoolId: sid, ...c }).lean(),
    Meta.findOne({ schoolId: sid, ...c }).lean(),
    School.findById(sid).select("subjects lists signature").lean()
  ]);
  const reports = {};
  reps.forEach(r => { (reports[r.type] = reports[r.type] || {})[String(r.studentId)] = r; });
  const days = {};
  att.forEach(a => { days[a.date] = a.marks || {}; });
  return { students, reports, att: days, meta: meta || { cls: {}, students: {} }, sch,
    subjects: SBC.subs(sch.subjects, c.className), className: c.className, term: c.term, year: c.year };
}

// Staff: load a class
router.get("/class", auth(STAFF), async (req, res) => {
  try {
    const c = key(req, req.query);
    if (!(await allowed(req, c.className))) return res.status(403).json({ error: "Not your class" });
    const b = await bundle(req.user.schoolId, c);
    res.json({ students: b.students, reports: b.reports, att: b.att, meta: b.meta, lists: b.sch.lists || {}, signature: b.sch.signature || "" });
  } catch (e) { bad(res, e); }
});

// Staff: save ONE student's ONE subject. terminal: raw = 6 boxes. mockN: raw = [score out of 100]
router.post("/score", auth(STAFF), async (req, res) => {
  try {
    const { className, term, year, studentId, subject, raw } = req.body, type = req.body.type || "terminal";
    if (!/^(terminal|mock[1-7])$/.test(type)) return bad(res, "Wrong type");
    if (!(await allowed(req, className))) return res.status(403).json({ error: "Not your class" });
    const st = await Student.findOne({ _id: studentId, schoolId: req.user.schoolId, className }).select("_id");
    if (!st) return res.status(404).json({ error: "Student not found" });
    const k = { schoolId: req.user.schoolId, studentId, term, year: Number(year), type };
    let r = await Report.findOne(k);
    if (!r) r = new Report({ ...k, className, subjects: [] });
    r.className = className;
    let e = r.subjects.find(x => x.name === subject);
    if (!e) { r.subjects.push({ name: subject }); e = r.subjects[r.subjects.length - 1]; }
    const clean = (v, m) => (v === null || v === undefined || v === "" || isNaN(+v)) ? null : Math.round(Math.max(0, Math.min(m, +v)));
    if (type === "terminal") {
      e.raw = SBC.MX.map((m, i) => clean((raw || [])[i], m));
      const c = SBC.cs({ raw: e.raw });
      e.classScore = c ? c.c : undefined; e.examScore = c ? c.e : undefined;
    } else {
      const v = clean((raw || [])[0], 100);
      e.score = v === null ? undefined : v;
    }
    r.teacherId = req.user.id; r.updatedAt = new Date();
    r.markModified("subjects");
    await r.save();
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// Staff: mark attendance for one day. marks = { studentId: "P" | "A" }. clear = true deletes the day.
router.post("/attendance", auth(STAFF), async (req, res) => {
  try {
    const k = { ...key(req, req.body), date: String(req.body.date || "") };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k.date)) return bad(res, "Wrong date");
    if (!(await allowed(req, k.className))) return res.status(403).json({ error: "Not your class" });
    if (req.body.clear) { await Attendance.deleteOne(k); return res.json({ ok: true }); }
    const set = {};
    Object.entries(req.body.marks || {}).forEach(([id, v]) => { if (OID.test(id) && (v === "P" || v === "A")) set["marks." + id] = v; });
    if (Object.keys(set).length) await Attendance.updateOne(k, { $set: set }, { upsert: true });
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// Staff: conduct, remarks, days present, class dates and bills. Send one {studentId, patch} or many in items.
router.post("/meta", auth(STAFF), async (req, res) => {
  try {
    const k = key(req, req.body), sid = req.user.schoolId;
    if (!(await allowed(req, k.className))) return res.status(403).json({ error: "Not your class" });
    const items = req.body.items || [{ studentId: req.body.studentId, patch: req.body.patch }];
    const set = {};
    for (const it of items) {
      const p = it.patch || {};
      if (it.studentId) {
        if (!OID.test(it.studentId)) continue;
        if (p.ph !== undefined) await Student.updateOne({ _id: it.studentId, schoolId: sid }, { photo: String(p.ph).slice(0, 300000) });
        SK.forEach(f => { if (p[f] !== undefined) set[`students.${it.studentId}.${f}`] = String(p[f]).slice(0, 500); });
      } else CK.forEach(f => { if (p[f] !== undefined) set["cls." + f] = String(p[f]).slice(0, 100); });
    }
    if (Object.keys(set).length) await Meta.updateOne(k, { $set: set }, { upsert: true });
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// Staff: add many students at once (one name per line)
router.post("/pupils", auth(STAFF), async (req, res) => {
  try {
    const { className } = req.body;
    if (!(await allowed(req, className))) return res.status(403).json({ error: "Not your class" });
    const names = (req.body.names || []).map(x => String(x).trim()).filter(Boolean).slice(0, 200);
    await Student.insertMany(names.map(name => ({ schoolId: req.user.schoolId, name, className })));
    res.json({ added: names.length });
  } catch (e) { bad(res, e); }
});

// Ready-made lists (anyone on staff) and the head teacher's signature (owner/head only)
router.post("/settings", auth(STAFF), async (req, res) => {
  try {
    const sid = req.user.schoolId, set = {};
    if (req.body.lists) {
      const cur = ((await School.findById(sid).select("lists").lean()).lists) || {};
      ["cd", "at", "it", "tr"].forEach(f => {
        if (Array.isArray(req.body.lists[f])) cur[f] = req.body.lists[f].map(x => String(x).trim()).filter(Boolean).slice(0, 60);
      });
      set.lists = cur;
    }
    if (req.body.signature !== undefined && HEAD.includes(req.user.role)) set.signature = String(req.body.signature).slice(0, 300000);
    if (Object.keys(set).length) await School.findByIdAndUpdate(sid, { $set: set });
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// Head/owner: how far every class is with its scores
router.get("/overview", auth(HEAD), async (req, res) => {
  try {
    const sid = req.user.schoolId, term = req.query.term, year = Number(req.query.year);
    const sch = await School.findById(sid).select("classes subjects").lean();
    const stu = await Student.find({ schoolId: sid, active: true }).select("className").lean();
    const reps = await Report.find({ schoolId: sid, term, year, type: "terminal" }).lean();
    res.json(sch.classes.map(c => {
      const ss = SBC.subs(sch.subjects, c), P = stu.filter(s => s.className === c).map(s => String(s._id));
      const started = new Set(); let done = 0;
      reps.filter(r => P.includes(String(r.studentId))).forEach(r => (r.subjects || []).forEach(x => {
        if (ss.includes(x.name) && SBC.cs(x)) { done++; started.add(x.name); }
      }));
      const total = P.length * ss.length;
      return { className: c, pupils: P.length, subjects: ss.length, started: started.size, pct: total ? Math.round(done / total * 100) : 0 };
    }));
  } catch (e) { bad(res, e); }
});

// Parent: published report cards (terminal and mock) of their children, with positions worked out here
router.get("/mine", auth(["parent"]), async (req, res) => {
  try {
    const sid = req.user.schoolId;
    const kids = await Student.find({ schoolId: sid, parents: req.user.id, active: true }).select("name photo className").lean();
    const mine = await Report.find({ schoolId: sid, studentId: { $in: kids.map(k => k._id) }, published: true, type: { $regex: /^(terminal|mock[1-7])$/ } }).sort({ year: -1, term: -1 }).lean();
    const cache = {}, packs = [];
    for (const r of mine) {
      const ck = [r.className, r.term, r.year].join("|");
      if (!cache[ck]) cache[ck] = await bundle(sid, { className: r.className, term: r.term, year: r.year });
      const kid = kids.find(k => String(k._id) === String(r.studentId));
      const s = cache[ck].students.find(x => String(x._id) === String(r.studentId)) || kid;
      const p = SBC.pack(cache[ck], s, r.type);
      if (p) packs.push(p);
    }
    const sch = await School.findById(sid).select("signature").lean();
    res.json({ packs, signature: sch.signature || "" });
  } catch (e) { bad(res, e); }
});

module.exports = router;