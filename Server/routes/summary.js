// routes/summary.js - fee summary by class and the pupil profile. Loaded as /api/summary
const router = require("express").Router();
const School = require("../models/School");
const Student = require("../models/Student");
const Payment = require("../models/Payment");
const Report = require("../models/Report");
const Attendance = require("../models/Attendance");
const auth = require("../middleware/auth");
const { studentFees } = require("../utils/balance");
const SBC = require("../utils/sbacalc");

const HEAD = ["owner", "head"];
const bad = (res, e) => res.status(400).json({ error: e.message || e });
const r2 = n => Math.round(n * 100) / 100;

// How much each class should pay, has paid and still owes
router.get("/fees", auth(HEAD), async (req, res) => {
  try {
    const sid = req.user.schoolId;
    const sch = await School.findById(sid).select("classes").lean();
    const students = await Student.find({ schoolId: sid, active: true }).lean();
    const by = {};
    for (const s of students) {
      const fees = await studentFees(s);
      const o = by[s.className] = by[s.className] || { className: s.className, pupils: 0, expected: 0, paid: 0, owing: 0, owingPupils: 0 };
      o.pupils++;
      const exp = fees.reduce((a, f) => a + f.amount, 0), paid = fees.reduce((a, f) => a + f.paid, 0), owe = fees.reduce((a, f) => a + f.balance, 0);
      o.expected += exp; o.paid += paid; o.owing += owe; if (owe > 0) o.owingPupils++;
    }
    const order = (sch && sch.classes) || [];
    const list = Object.values(by).map(o => ({ ...o, expected: r2(o.expected), paid: r2(o.paid), owing: r2(o.owing) }))
      .sort((a, b) => (order.indexOf(a.className) + 1 || 999) - (order.indexOf(b.className) + 1 || 999));
    res.json(list);
  } catch (e) { bad(res, e); }
});

// One pupil: parents, fees, payments, attendance and results
router.get("/student/:id", auth(HEAD), async (req, res) => {
  try {
    const sid = req.user.schoolId;
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) return bad(res, "Wrong student");
    const st = await Student.findOne({ _id: req.params.id, schoolId: sid }).populate("parents", "name phone email").lean();
    if (!st) return res.status(404).json({ error: "Student not found" });

    const fees = await studentFees(st);
    const pays = await Payment.find({ studentId: st._id, status: "success" }).select("-proof").populate("feeId", "title").sort({ paidAt: -1 }).limit(30).lean();

    const year = Number(req.query.year) || new Date().getFullYear();
    const att = await Attendance.find({ schoolId: sid, className: st.className, year }).select("marks").lean();
    let present = 0, absent = 0;
    att.forEach(a => { const v = (a.marks || {})[String(st._id)]; if (v === "P") present++; else if (v === "A") absent++; });

    const reps = await Report.find({ schoolId: sid, studentId: st._id, type: "terminal" }).sort({ year: -1, term: -1 }).limit(6).lean();
    const results = reps.map(r => {
      const subs = (r.subjects || []).map(x => { const c = SBC.cs(x); return c ? { name: x.name, total: c.t } : null; }).filter(Boolean);
      return { term: r.term, year: r.year, className: r.className, subjects: subs, average: subs.length ? Math.round(subs.reduce((a, x) => a + x.total, 0) / subs.length) : 0 };
    });

    res.json({
      student: { id: st._id, name: st.name, className: st.className, gender: st.gender, photo: st.photo || "", parents: st.parents || [] },
      fees, payments: pays.map(p => ({ title: p.feeId ? p.feeId.title : "", amount: p.amount, method: p.method, paidAt: p.paidAt, txnId: p.txnId })),
      attendance: { year, present, absent }, results
    });
  } catch (e) { bad(res, e); }
});

module.exports = router;
