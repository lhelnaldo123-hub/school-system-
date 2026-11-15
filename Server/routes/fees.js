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

// Head records a cash/bank payment made at the office
router.post("/cash", auth(["owner", "head"]), async (req, res) => {
  const { studentId, feeId, amount } = req.body;
  const p = await Payment.create({
    schoolId: req.user.schoolId, studentId, feeId, amount, method: "cash",
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
