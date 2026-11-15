const router = require("express").Router();
const Report = require("../models/Report");
const Student = require("../models/Student");
const User = require("../models/User");
const auth = require("../middleware/auth");

const total = r => r.subjects.reduce((a, s) => a + (+s.classScore || 0) + (+s.examScore || 0), 0);
const clamp = (v, max) => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : Math.max(0, Math.min(max, n));
};

// A teacher with classes set can only work on those classes
async function classAllowed(req, className) {
  if (req.user.role !== "teacher") return true;
  const u = await User.findById(req.user.id);
  return !u.classes.length || u.classes.includes(className);
}

// Staff: students of a class + their reports for a term
router.get("/class", auth(["owner", "head", "teacher"]), async (req, res) => {
  try {
    const { className, term, year, type } = req.query;
    if (!(await classAllowed(req, className))) return res.status(403).json({ error: "Not your class" });
    const students = await Student.find({ schoolId: req.user.schoolId, className, active: true }).sort({ name: 1 }).select("name");
    const reps = await Report.find({ schoolId: req.user.schoolId, className, term, year: Number(year), type: type || "terminal" });
    const reports = {};
    reps.forEach(r => { reports[r.studentId] = r; });
    res.json({ students, reports });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Staff: save scores for many students (one subject or many)
router.post("/bulk", auth(["owner", "head", "teacher"]), async (req, res) => {
  try {
    const { className, term, year, type, items } = req.body;
    if (!(await classAllowed(req, className))) return res.status(403).json({ error: "Not your class" });
    const ids = (await Student.find({ schoolId: req.user.schoolId, className }).select("_id")).map(s => String(s._id));
    let saved = 0;
    for (const it of items || []) {
      if (!ids.includes(String(it.studentId))) continue;
      const key = { schoolId: req.user.schoolId, studentId: it.studentId, term, year: Number(year), type: type || "terminal" };
      let r = await Report.findOne(key);
      if (!r) r = new Report({ ...key, className, subjects: [] });
      r.className = className;
      for (const s of it.subjects || []) {
        const c = clamp(s.classScore, 50), e = clamp(s.examScore, 50);
        if (c === undefined && e === undefined) continue;
        const ex = r.subjects.find(x => x.name === s.name);
        if (ex) { ex.classScore = c; ex.examScore = e; }
        else r.subjects.push({ name: s.name, classScore: c, examScore: e });
      }
      if (typeof it.remark === "string" && it.remark.trim()) r.remark = it.remark.trim();
      r.teacherId = req.user.id;
      r.updatedAt = new Date();
      await r.save();
      saved++;
    }
    res.json({ saved });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Head/owner: show or hide a class's reports to parents
router.post("/publish", auth(["owner", "head"]), async (req, res) => {
  const { className, term, year, type, published } = req.body;
  const r = await Report.updateMany(
    { schoolId: req.user.schoolId, className, term, year: Number(year), type: type || "terminal" },
    { $set: { published: !!published } }
  );
  res.json({ updated: r.modifiedCount });
});

// Parent: published reports of ALL their children, with class position
router.get("/mine", auth(["parent"]), async (req, res) => {
  try {
    const kids = await Student.find({ schoolId: req.user.schoolId, parents: req.user.id });
    const names = {};
    kids.forEach(k => { names[k._id] = k.name; });
    const reps = await Report.find({
      schoolId: req.user.schoolId, studentId: { $in: kids.map(k => k._id) }, published: true
    }).sort({ year: -1, term: -1 });

    const cache = {}, out = [];
    for (const r of reps) {
      const key = [r.className, r.term, r.year, r.type].join("|");
      if (!cache[key]) {
        const all = await Report.find({ schoolId: req.user.schoolId, className: r.className, term: r.term, year: r.year, type: r.type });
        cache[key] = all.map(total).sort((a, b) => b - a);
      }
      const t = total(r);
      out.push({ ...r.toObject(), studentName: names[r.studentId], total: t, position: cache[key].indexOf(t) + 1, outOf: cache[key].length });
    }
    res.json(out);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
