const router = require("express").Router();
const Fee = require("../models/Fee");
const Student = require("../models/Student");
const Payment = require("../models/Payment");
const auth = require("../middleware/auth");
const { studentFees } = require("../utils/balance");
const User = require("../models/User");
const { notifyUsers, notifyStaff } = require("../utils/notify");

// Head/owner creates a fee (school fees, exam fee, mock fee...)
router.post("/", auth(["owner", "head"]), async (req, res) => {
  try {
    const { title, type, amount, className, dueDate } = req.body;
    res.json(await Fee.create({ schoolId: req.user.schoolId, title, type, amount, className: className || "all", dueDate }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/", auth(["owner", "head", "teacher"]), async (req, res) => {
  res.json(await Fee.find({ schoolId: req.user.schoolId }).sort({ dueDate: -1 }));
});

// Parent: fees + balances for each of their children
router.get("/mine", auth(["parent"]), async (req, res) => {
  const kids = await Student.find({ schoolId: req.user.schoolId, parents: req.user.id, active: true });
  const out = [];
  for (const k of kids) out.push({ student: { id: k._id, name: k.name, className: k.className }, fees: await studentFees(k) });
  res.json(out);
});

// Parent: recent payments for their children
router.get("/history", auth(["parent"]), async (req, res) => {
  const kids = await Student.find({ schoolId: req.user.schoolId, parents: req.user.id }).select("_id name");
  const ids = kids.map(k => k._id);
  const pays = await Payment.find({ studentId: { $in: ids }, status: "success" })
    .populate("feeId", "title").populate("studentId", "name").sort({ paidAt: -1 }).limit(50);
  res.json(pays);
});

// Head/owner: fees and balances of one student
router.get("/student/:id", auth(["owner", "head"]), async (req, res) => {
  const st = await Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!st) return res.status(404).json({ error: "Student not found" });
  res.json(await studentFees(st));
});

// Head/owner removes a fee that nobody has paid yet
router.delete("/:id", auth(["owner", "head"]), async (req, res) => {
  const paid = await Payment.findOne({ feeId: req.params.id, schoolId: req.user.schoolId, status: "success" });
  if (paid) return res.status(400).json({ error: "Payments already made on this fee, cannot delete" });
  await Fee.deleteOne({ _id: req.params.id, schoolId: req.user.schoolId });
  res.json({ ok: true });
});

// Head records a cash/bank payment made at the office
router.post("/cash", auth(["owner", "head"]), async (req, res) => {
  const { studentId, feeId, amount } = req.body;
  const st = await Student.findOne({ _id: studentId, schoolId: req.user.schoolId });
  if (!st) return res.status(404).json({ error: "Student not found" });
  const fee = (await studentFees(st)).find(x => String(x.feeId) === String(feeId));
  if (!fee) return res.status(404).json({ error: "Fee not found" });
  const amt = Math.min(Number(amount) || fee.balance, fee.balance);
  if (amt <= 0) return res.status(400).json({ error: "Nothing to pay" });
  const p = await Payment.create({
    schoolId: req.user.schoolId, studentId, feeId, amount: amt, method: "cash",
    reference: "CASH-" + Date.now(), status: "success", paidAt: new Date()
  });
  res.json(p);
});

// Head: list of students who owe, with totals
router.get("/owing", auth(["owner", "head"]), async (req, res) => {
  const students = await Student.find({ schoolId: req.user.schoolId, active: true }).populate("parents", "name phone");
  const out = [];
  for (const s of students) {
    const fees = await studentFees(s);
    const owed = fees.reduce((a, f) => a + f.balance, 0);
    if (owed > 0) out.push({ id: s._id, name: s.name, className: s.className, owed, parents: s.parents });
  }
  res.json(out);
});

// ---------- Mobile money with screenshot proof (the head confirms) ----------
const cleanId = v => String(v || "").trim().toUpperCase().replace(/\s+/g, "");

// Parent sends proof of a MoMo payment
router.post("/momo", auth(["parent"]), async (req, res) => {
  try {
    const { studentId, feeId, amount, txnId, proof, payerNumber } = req.body;
    const st = await Student.findOne({ _id: studentId, schoolId: req.user.schoolId, parents: req.user.id });
    if (!st) return res.status(403).json({ error: "Not your child" });
    const fee = (await studentFees(st)).find(x => String(x.feeId) === String(feeId));
    if (!fee) return res.status(404).json({ error: "Fee not found" });
    const amt = Number(amount);
    if (!(amt > 0)) return res.status(400).json({ error: "Write the amount you sent" });
    const waiting = await Payment.find({ studentId, feeId, method: "momo", status: "review" });
    const wsum = waiting.reduce((a, x) => a + x.amount, 0);
    if (amt > fee.balance - wsum + 0.001) return res.status(400).json({ error: "That is more than is still owed" + (wsum ? " (GHS " + wsum.toFixed(2) + " is already waiting for confirmation)" : "") });
    const t = cleanId(txnId);
    if (t.length < 6) return res.status(400).json({ error: "Write the MoMo transaction ID from your SMS" });
    if (await Payment.findOne({ schoolId: req.user.schoolId, txnId: t, status: { $in: ["review", "success"] } }))
      return res.status(400).json({ error: "This transaction ID has already been used" });
    if (!/^data:image\//.test(proof || "")) return res.status(400).json({ error: "Add the screenshot of the payment" });
    if (proof.length > 1800000) return res.status(400).json({ error: "The screenshot is too big, try another" });
    const p = await Payment.create({
      schoolId: req.user.schoolId, studentId, feeId, parentId: req.user.id, amount: amt, method: "momo",
      reference: "MOMO-" + Date.now() + "-" + Math.floor(Math.random() * 1000), status: "review",
      txnId: t, payerNumber: String(payerNumber || "").trim(), proof
    });
    const who = await User.findById(req.user.id).select("name");
    notifyStaff(req.user.schoolId, "📲 MoMo payment to confirm", (who ? who.name : "A parent") + " sent GHS " + amt.toFixed(2) + " for " + st.name + " (" + fee.title + "). Open the screenshot and confirm.", "momo");
    res.json({ ok: true, id: p._id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Parent: their MoMo payments waiting or rejected
router.get("/momo/mine", auth(["parent"]), async (req, res) => {
  const kids = await Student.find({ schoolId: req.user.schoolId, parents: req.user.id }).select("_id");
  res.json(await Payment.find({ studentId: { $in: kids.map(k => k._id) }, method: "momo", status: { $in: ["review", "rejected"] } })
    .select("-proof").populate("feeId", "title").populate("studentId", "name").sort({ createdAt: -1 }).limit(30));
});

// Head: MoMo payments to confirm
router.get("/momo/review", auth(["owner", "head"]), async (req, res) => {
  res.json(await Payment.find({ schoolId: req.user.schoolId, method: "momo", status: "review" }).select("-proof")
    .populate("studentId", "name className").populate("feeId", "title").populate("parentId", "name phone").sort({ createdAt: 1 }));
});

router.get("/momo/proof/:id", auth(["owner", "head"]), async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, schoolId: req.user.schoolId }).select("proof");
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json({ proof: p.proof });
});

router.post("/momo/:id/approve", auth(["owner", "head"]), async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, schoolId: req.user.schoolId, method: "momo", status: "review" });
  if (!p) return res.status(404).json({ error: "Already decided or not found" });
  const st = await Student.findById(p.studentId);
  const fee = st && (await studentFees(st)).find(x => String(x.feeId) === String(p.feeId));
  if (!fee) return res.status(404).json({ error: "Fee not found" });
  const amt = Math.min(Number(req.body.amount) || p.amount, fee.balance);
  if (amt <= 0) return res.status(400).json({ error: "Nothing left to pay on this fee" });
  p.amount = amt; p.status = "success"; p.paidAt = new Date(); p.decidedBy = req.user.id; p.decidedAt = new Date();
  await p.save();
  if (p.parentId) notifyUsers(p.schoolId, [p.parentId], "✅ Payment confirmed", "The school confirmed your MoMo payment of GHS " + amt.toFixed(2) + " for " + st.name + ".", "history");
  res.json({ ok: true });
});

router.post("/momo/:id/reject", auth(["owner", "head"]), async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, schoolId: req.user.schoolId, method: "momo", status: "review" });
  if (!p) return res.status(404).json({ error: "Already decided or not found" });
  p.status = "rejected"; p.reason = String(req.body.reason || "").slice(0, 200); p.decidedBy = req.user.id; p.decidedAt = new Date();
  await p.save();
  if (p.parentId) notifyUsers(p.schoolId, [p.parentId], "❌ Payment not accepted", p.reason || "Please contact the school about your MoMo payment.", "pay");
  res.json({ ok: true });
});

module.exports = router;