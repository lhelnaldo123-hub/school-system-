// Your private admin API (only you). Protected by ADMIN_PASSWORD set on Render.
const router = require("express").Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Invite = require("../models/Invite");
const School = require("../models/School");
const User = require("../models/User");
const Student = require("../models/Student");

const tries = {}; // simple brute-force guard: ip -> {n, t}
function same(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function guard(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const p = jwt.verify(h.startsWith("Bearer ") ? h.slice(7) : "", process.env.JWT_SECRET);
    if (p.role !== "admin") throw new Error("no");
    next();
  } catch (e) { res.status(401).json({ error: "Admin sign-in needed" }); }
}
function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  const b = crypto.randomBytes(8);
  let s = ""; for (let i = 0; i < 8; i++) s += A[b[i] % A.length];
  return s.slice(0, 4) + "-" + s.slice(4);
}

router.post("/login", (req, res) => {
  const ip = req.ip, now = Date.now();
  const t = tries[ip] = (tries[ip] && now - tries[ip].t < 15 * 60000) ? tries[ip] : { n: 0, t: now };
  if (t.n >= 8) return res.status(429).json({ error: "Too many tries. Wait 15 minutes." });
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: "ADMIN_PASSWORD is not set on the server" });
  if (!same(req.body.password || "", process.env.ADMIN_PASSWORD)) { t.n++; return res.status(400).json({ error: "Wrong password" }); }
  delete tries[ip];
  res.json({ token: jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "12h" }) });
});

// Make 1-20 new codes
router.post("/codes", guard, async (req, res) => {
  try {
    const n = Math.min(Math.max(parseInt(req.body.count) || 1, 1), 20);
    const days = parseInt(req.body.days) || 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(await Invite.create({
        code: newCode(), note: String(req.body.note || "").slice(0, 120),
        expiresAt: days > 0 ? new Date(Date.now() + days * 86400000) : undefined
      }));
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All codes + who used them, and all registered schools
router.get("/overview", guard, async (req, res) => {
  try {
    const [codes, schools] = await Promise.all([Invite.find().sort({ createdAt: -1 }).lean(), School.find().sort({ createdAt: -1 }).lean()]);
    const byId = {}; schools.forEach(s => byId[s._id] = s);
    const rows = await Promise.all(schools.map(async s => {
      const owner = await User.findOne({ schoolId: s._id, role: "owner" }).select("name email phone").lean();
      return {
        id: s._id, name: s.name, code: s.code, createdAt: s.createdAt, owner,
        students: await Student.countDocuments({ schoolId: s._id }),
        users: await User.countDocuments({ schoolId: s._id })
      };
    }));
    res.json({
      codes: codes.map(c => ({ id: c._id, code: c.code, note: c.note, used: c.used, usedAt: c.usedAt, expiresAt: c.expiresAt, createdAt: c.createdAt, school: c.schoolId && byId[c.schoolId] ? byId[c.schoolId].name : "" })),
      schools: rows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete an UNUSED code (cancel it)
router.delete("/codes/:id", guard, async (req, res) => {
  const r = await Invite.deleteOne({ _id: req.params.id, used: false });
  res.json({ ok: r.deletedCount === 1 });
});

module.exports = router;
