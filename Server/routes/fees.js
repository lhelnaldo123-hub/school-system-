const router = require("express").Router();
const Fee = require("../models/Fee");
const Student = require("../models/Student");
const Payment = require("../models/Payment");
const auth = require("../middleware/auth");
const { studentFees } = require("../utils/balance");

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

module.exports = router;
