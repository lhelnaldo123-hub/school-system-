const router = require("express").Router();
const School = require("../models/School");
const Student = require("../models/Student");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { deliver, whatsappOn } = require("../services/whatsapp");
const { messageFor, runSchool } = require("../jobs/reminder");

// What is switched on (the app shows this in School Settings)
router.get("/status", auth(["owner", "head"]), (req, res) => {
  res.json({ whatsapp: whatsappOn(), template: !!process.env.WHATSAPP_TEMPLATE, sms: !!process.env.SMS_PROVIDER });
});

// Send a test message to the signed-in person's own phone
router.post("/test", auth(["owner", "head"]), async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    const school = await School.findById(req.user.schoolId);
    const phone = String(req.body.phone || (me && me.phone) || "").trim();
    if (!phone) return res.status(400).json({ error: "Write a phone number (or add one to your account) first" });
    const channel = req.body.channel === "whatsapp" ? "whatsapp" : "sms";
    const r = await deliver({ channel, to: phone, school: school.name, smsFallback: false, message: "Test message from " + school.name + ". If you can read this, " + (channel === "whatsapp" ? "WhatsApp" : "SMS") + " is working." });
    if (!r.ok) return res.status(400).json({ error: "Could not send: " + (r.reason || "unknown problem") });
    res.json({ ok: true, via: r.via });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Remind the parents of ONE student now
router.post("/send", auth(["owner", "head"]), async (req, res) => {
  try {
    const school = await School.findById(req.user.schoolId);
    const st = await Student.findOne({ _id: req.body.studentId, schoolId: req.user.schoolId }).populate("parents", "name phone");
    if (!st) return res.status(404).json({ error: "Student not found" });
    const m = await messageFor(school, st);
    if (!m) return res.status(400).json({ error: "This student owes nothing" });
    const phones = (st.parents || []).filter(p => p && p.phone);
    if (!phones.length) return res.status(400).json({ error: "No parent phone number is saved for this student" });
    const channel = (req.body.channel || (school.reminder && school.reminder.channel) || "sms") === "whatsapp" ? "whatsapp" : "sms";
    let ok = 0, via = channel, why = "";
    for (const p of phones) {
      const r = await deliver({ channel, to: p.phone, message: m.message, school: school.name, smsFallback: !!req.body.smsFallback });
      if (r.ok) { ok++; via = r.via; } else why = r.reason || why;
    }
    if (!ok) return res.status(400).json({ error: "Not sent: " + (why || "unknown problem") });
    res.json({ ok: true, sent: ok, via });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Remind EVERY parent who owes, now
router.post("/run", auth(["owner", "head"]), async (req, res) => {
  try {
    const school = await School.findById(req.user.schoolId);
    res.json(await runSchool(school, true));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;