// routes/backup.js - the owner downloads a copy of all the school's data. Loaded as /api/backup
const router = require("express").Router();
const auth = require("../middleware/auth");
const School = require("../models/School");
const User = require("../models/User");
const Student = require("../models/Student");
const Fee = require("../models/Fee");
const Payment = require("../models/Payment");
const Report = require("../models/Report");
const Attendance = require("../models/Attendance");
const Meta = require("../models/TermMeta");
const Notice = require("../models/Notice");
const DailyReport = require("../models/DailyReport");
const StaffAttendance = require("../models/StaffAttendance");

router.get("/", auth(["owner"]), async (req, res) => {
  try {
    const q = { schoolId: req.user.schoolId };
    const [school, users, students, fees, payments, reports, attendance, meta, notices, daily, staff] = await Promise.all([
      School.findById(req.user.schoolId).select("-reportTpl.img").lean(),
      User.find(q).select("-passwordHash").lean(),
      Student.find(q).select("-photo").lean(),
      Fee.find(q).lean(),
      Payment.find(q).select("-proof").lean(),
      Report.find(q).lean(),
      Attendance.find(q).lean(),
      Meta.find(q).lean(),
      Notice.find(q).lean(),
      DailyReport.find(q).lean(),
      StaffAttendance.find(q).lean()
    ]);
    res.json({ madeAt: new Date(), note: "School backup. Photos, signatures, payment screenshots and passwords are not included.",
      school, users, students, fees, payments, reports, attendance, termMeta: meta, notices, dailyReports: daily, staffAttendance: staff });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
