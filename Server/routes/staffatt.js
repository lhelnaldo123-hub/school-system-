// routes/staffatt.js - teacher attendance (head teacher / owner marks it). Loaded as /api/staffatt
const router = require("express").Router();
const StaffAttendance = require("../models/StaffAttendance");
const User = require("../models/User");
const auth = require("../middleware/auth");

const HEAD = ["owner", "head"];
const OID = /^[a-f0-9]{24}$/;
const bad = (res, e) => res.status(400).json({ error: e.message || e });
const teachers = sid => User.find({ schoolId: sid, role: "teacher", active: true }).select("name").sort({ name: 1 }).lean();

// One day: the teachers and what was marked
router.get("/", auth(HEAD), async (req, res) => {
  try {
    const date = String(req.query.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, "Wrong date");
    const d = await StaffAttendance.findOne({ schoolId: req.user.schoolId, date }).lean();
    res.json({ teachers: await teachers(req.user.schoolId), marks: (d && d.marks) || {} });
  } catch (e) { bad(res, e); }
});

// Mark teachers. marks = { userId: "P" | "A" | "L" | "" }  ("" clears the mark)
router.post("/", auth(HEAD), async (req, res) => {
  try {
    const date = String(req.body.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, "Wrong date");
    const set = {}, unset = {};
    Object.entries(req.body.marks || {}).forEach(([id, v]) => {
      if (!OID.test(id)) return;
      if (v === "P" || v === "A" || v === "L") set["marks." + id] = v; else if (v === "") unset["marks." + id] = "";
    });
    const upd = {};
    if (Object.keys(set).length) upd.$set = set;
    if (Object.keys(unset).length) upd.$unset = unset;
    if (Object.keys(upd).length) await StaffAttendance.updateOne({ schoolId: req.user.schoolId, date }, upd, { upsert: true });
    res.json({ ok: true });
  } catch (e) { bad(res, e); }
});

// A whole month (for the monthly report)
router.get("/month", auth(HEAD), async (req, res) => {
  try {
    const month = String(req.query.month || "");
    if (!/^\d{4}-\d{2}$/.test(month)) return bad(res, "Wrong month");
    const days = await StaffAttendance.find({ schoolId: req.user.schoolId, date: { $regex: "^" + month } }).sort({ date: 1 }).lean();
    res.json({ teachers: await teachers(req.user.schoolId), days });
  } catch (e) { bad(res, e); }
});

module.exports = router;
