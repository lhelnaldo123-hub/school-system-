// routes/announce.js - send a notice to parents on WhatsApp (and show it in the app). Loaded as /api/announce
const router = require("express").Router();
const School = require("../models/School");
const Student = require("../models/Student");
const Notice = require("../models/Notice");
const auth = require("../middleware/auth");
const { deliver, whatsappOn, clean } = require("../services/whatsapp");
const { notifyUsers } = require("../utils/notify");

const HEAD = ["owner", "head"];
const last = {};                     // last send of each school (kept in memory)
const wait = ms => new Promise(r => setTimeout(r, ms));

async function parentsOf(schoolId, className) {
  const q = { schoolId, active: true };
  if (className && className !== "all") q.className = className;
  const stu = await Student.find(q).populate("parents", "phone").lean();
  const ids = new Set(), phones = new Map();
  stu.forEach(s => (s.parents || []).forEach(p => {
    if (!p) return;
    ids.add(String(p._id));
    const c = clean(p.phone);
    if (c && c.length >= 11) phones.set(c, p.phone);
  }));
  return { ids: [...ids], phones: [...phones.values()] };
}

// How many parents would get it, and what is switched on
router.get("/count", auth(HEAD), async (req, res) => {
  try {
    const p = await parentsOf(req.user.schoolId, req.query.className);
    res.json({ parents: p.ids.length, phones: p.phones.length, whatsapp: whatsappOn(), template: !!process.env.WHATSAPP_TEMPLATE, last: last[req.user.schoolId] || null });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Send. It answers at once and keeps sending in the background (one message every moment, so WhatsApp is not flooded).
router.post("/send", auth(HEAD), async (req, res) => {
  try {
    const sid = req.user.schoolId, className = req.body.className || "all";
    const message = String(req.body.message || "").trim().slice(0, 900);
    if (message.length < 3) return res.status(400).json({ error: "Write the message" });
    if (!whatsappOn()) return res.status(400).json({ error: "WhatsApp is not set up on the server yet (WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in Render)" });
    const p = await parentsOf(sid, className);
    if (!p.phones.length) return res.status(400).json({ error: "No parent phone numbers found for this choice" });
    const school = await School.findById(sid).select("name").lean();

    // also show it inside the app
    await Notice.create({ schoolId: sid, title: "School notice", body: message, audience: "parents", className, createdBy: req.user.id });
    notifyUsers(sid, p.ids, "📢 School notice", message.slice(0, 120), "notices");

    const run = { startedAt: new Date(), total: p.phones.length, sent: 0, failed: 0, reason: "", done: false };
    last[sid] = run;
    res.json({ queued: p.phones.length });

    (async () => {
      for (const phone of p.phones) {
        const r = await deliver({ channel: "whatsapp", to: phone, message, school: school.name, smsFallback: false });
        if (r.ok) run.sent++; else { run.failed++; run.reason = r.reason || run.reason; }
        await wait(350);
      }
      run.done = true;
    })().catch(e => { run.done = true; run.reason = e.message; });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
