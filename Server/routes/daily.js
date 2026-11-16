// routes/daily.js - the head teacher's daily report (written by hand, one per day).
// Loaded automatically as /api/daily
const router = require("express").Router();
const DailyReport = require("../models/DailyReport");
const Student = require("../models/Student");
const Payment = require("../models/Payment");
const auth = require("../middleware/auth");

const HEAD = ["owner", "head"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const amt = v => { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
const cnt = v => { const n = Math.round(Number(v)); return isFinite(n) && n > 0 ? n : 0; };
const bad = (res, e) => res.status(400).json({ error: e.message || e });

// Open a day: the saved report (if any), the number of pupils in each class, and what the app recorded that day
router.get("/", auth(HEAD), async (req, res) => {
  try {
    const date = String(req.query.date || "");
    if (!DATE.test(date)) return bad(res, "Wrong date");
    const sid = req.user.schoolId;
    const report = await DailyReport.findOne({ schoolId: sid, date }).lean();

    const stu = await Student.find({ schoolId: sid, active: true }).select("className").lean();
    const roll = {};
    stu.forEach(s => { roll[s.className] = (roll[s.className] || 0) + 1; });

    const from = new Date(date + "T00:00:00.000Z"), to = new Date(from.getTime() + 864e5);
    const pays = await Payment.find({ schoolId: sid, status: "success", paidAt: { $gte: from, $lt: to } })
      .populate("feeId", "title type").lean();
    const system = { school: 0, feeding: 0, exam: 0, other: 0 };
    pays.forEach(p => {
      const f = p.feeId || {};
      const k = /feed/i.test(f.title || "") ? "feeding" : f.type === "exam" ? "exam" : f.type === "tuition" ? "school" : "other";
      system[k] += p.amount;
    });
    Object.keys(system).forEach(k => { system[k] = Math.round(system[k] * 100) / 100; });

    res.json({ report, roll, system });
  } catch (e) { bad(res, e); }
});

// Save (or change) the report of one day
router.post("/", auth(HEAD), async (req, res) => {
  try {
    const date = String(req.body.date || "");
    if (!DATE.test(date)) return bad(res, "Wrong date");
    const f = req.body.fees || {};
    const classes = (Array.isArray(req.body.classes) ? req.body.classes : []).slice(0, 60).map(c => ({
      className: String(c.className || "").slice(0, 60),
      onRoll: cnt(c.onRoll), present: cnt(c.present), absent: cnt(c.absent),
      names: String(c.names || "").slice(0, 500)
    }));
    const expenses = (Array.isArray(req.body.expenses) ? req.body.expenses : []).slice(0, 40)
      .map(x => ({ item: String(x.item || "").trim().slice(0, 80), amount: amt(x.amount) })).filter(x => x.item || x.amount);
    const doc = {
      classes, expenses,
      fees: { school: amt(f.school), feeding: amt(f.feeding), exam: amt(f.exam), other: amt(f.other) },
      notes: String(req.body.notes || "").slice(0, 2000),
      writtenBy: req.user.id, updatedAt: new Date()
    };
    await DailyReport.updateOne({ schoolId: req.user.schoolId, date }, { $set: doc }, { upsert: true });
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// The last days that have a report (to open or print an old one)
router.get("/recent", auth(HEAD), async (req, res) => {
  try {
    const list = await DailyReport.find({ schoolId: req.user.schoolId }).sort({ date: -1 }).limit(14).select("date fees").lean();
    res.json(list.map(r => ({ date: r.date, total: (r.fees.school || 0) + (r.fees.feeding || 0) + (r.fees.exam || 0) + (r.fees.other || 0) })));
  } catch (e) { bad(res, e); }
});

// Every daily report of one month, for the monthly report (?month=2026-11)
router.get("/month", auth(HEAD), async (req, res) => {
  try {
    const month = String(req.query.month || "");
    if (!/^\d{4}-\d{2}$/.test(month)) return bad(res, "Wrong month");
    res.json(await DailyReport.find({ schoolId: req.user.schoolId, date: { $regex: "^" + month } }).sort({ date: 1 }).lean());
  } catch (e) { bad(res, e); }
});

module.exports = router;
