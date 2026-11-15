const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const School = require("../models/School");
const User = require("../models/User");
const auth = require("../middleware/auth");

function sign(u) {
  return jwt.sign({ id: u._id, role: u.role, schoolId: u.schoolId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

// 1) Create a new school + its owner account (run once per school)
router.post("/register-school", async (req, res) => {
  try {
    const { schoolName, code, ownerName, email, password, phone, primary, accent } = req.body;
    if (!schoolName || !code || !ownerName || !email || !password)
      return res.status(400).json({ error: "Fill in all fields" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be 6+ characters" });
    if (await School.findOne({ code: code.toLowerCase() }))
      return res.status(400).json({ error: "That school code is taken" });

    const school = await School.create({
      name: schoolName, code, invoiceName: schoolName,
      colors: { primary: primary || "#0b2a8f", accent: accent || "#f5b800" }
    });
    const owner = await User.create({
      schoolId: school._id, name: ownerName, email, phone,
      passwordHash: await bcrypt.hash(password, 10), role: "owner"
    });
    res.json({ token: sign(owner), user: { id: owner._id, name: owner.name, role: owner.role }, school });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2) Login (school code + email + password)
router.post("/login", async (req, res) => {
  try {
    const { code, email, password } = req.body;
    const school = await School.findOne({ code: (code || "").toLowerCase() });
    if (!school) return res.status(400).json({ error: "School not found" });
    // sign in with email OR phone number
    const id = (email || "").trim().toLowerCase();
    const user = await User.findOne({ schoolId: school._id, $or: [{ email: id }, { phone: id }] });
    if (!user || !user.active || !(await bcrypt.compare(password || "", user.passwordHash)))
      return res.status(400).json({ error: "Wrong email/phone or password" });
    res.json({ token: sign(user), user: { id: user._id, name: user.name, role: user.role, classes: user.classes }, school });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3) Owner/head creates head, teacher or parent accounts
router.post("/users", auth(["owner", "head"]), async (req, res) => {
  try {
    let { name, email, phone, password, role, classes } = req.body;
    if (!["head", "teacher", "parent"].includes(role)) return res.status(400).json({ error: "Bad role" });
    if (!name) return res.status(400).json({ error: "Write the name" });
    // a parent without email signs in with the phone number
    if (!email && phone) email = String(phone).replace(/\D/g, "") + "@school-parent.com";
    if (!email) return res.status(400).json({ error: "Give an email or a phone number" });
    if (role === "head" && req.user.role !== "owner") return res.status(403).json({ error: "Only the owner adds a head" });
    const u = await User.create({
      schoolId: req.user.schoolId, name, email, phone, role, classes: classes || [],
      passwordHash: await bcrypt.hash(password || "123456", 10)
    });
    res.json({ id: u._id, name: u.name, role: u.role });
  } catch (e) {
    res.status(400).json({ error: e.code === 11000 ? "That email already exists" : e.message });
  }
});

// 4) List users of a role
router.get("/users", auth(["owner", "head"]), async (req, res) => {
  const q = { schoolId: req.user.schoolId };
  if (req.query.role) q.role = req.query.role;
  res.json(await User.find(q).select("-passwordHash").sort({ name: 1 }));
});

// 5) Change own password
router.post("/change-password", auth(), async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!(await bcrypt.compare(req.body.oldPassword || "", u.passwordHash)))
    return res.status(400).json({ error: "Old password is wrong" });
  u.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  await u.save();
  res.json({ ok: true });
});

module.exports = router;
