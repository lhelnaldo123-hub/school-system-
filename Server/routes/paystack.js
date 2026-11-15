const router = require("express").Router();
const crypto = require("crypto");
const Payment = require("../models/Payment");
const Fee = require("../models/Fee");
const Student = require("../models/Student");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { studentFees } = require("../utils/balance");

const PS = "https://api.paystack.co";
const hdr = () => ({ Authorization: "Bearer " + process.env.PAYSTACK_SECRET_KEY, "Content-Type": "application/json" });

// Parent starts a payment for one child + one fee
router.post("/init", auth(["parent"]), async (req, res) => {
  try {
    const { studentId, feeId, amount } = req.body;
    const student = await Student.findOne({ _id: studentId, schoolId: req.user.schoolId, parents: req.user.id });
    if (!student) return res.status(403).json({ error: "Not your child" });

    const fees = await studentFees(student);
    const fee = fees.find(f => String(f.feeId) === String(feeId));
    if (!fee) return res.status(404).json({ error: "Fee not found" });
    const pay = Math.min(Number(amount) || fee.balance, fee.balance);
    if (pay <= 0) return res.status(400).json({ error: "Nothing to pay" });

    const parent = await User.findById(req.user.id);
    const reference = "SCH-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

    await Payment.create({
      schoolId: req.user.schoolId, studentId, feeId, parentId: req.user.id,
      amount: pay, reference, status: "pending"
    });

    const r = await fetch(PS + "/transaction/initialize", {
      method: "POST", headers: hdr(),
      body: JSON.stringify({
        email: parent.email, amount: Math.round(pay * 100), currency: "GHS", reference,
        callback_url: (process.env.FRONTEND_URL || "") + "/?paid=" + reference,
        metadata: { studentId, feeId }
      })
    });
    const j = await r.json();
    if (!j.status) return res.status(400).json({ error: j.message || "Paystack error" });
    res.json({ url: j.data.authorization_url, reference });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Frontend calls this after Paystack sends the parent back
router.get("/verify/:reference", auth(["parent"]), async (req, res) => {
  const p = await Payment.findOne({ reference: req.params.reference, parentId: req.user.id });
  if (!p) return res.status(404).json({ error: "Not found" });
  if (p.status === "success") return res.json({ status: "success" });
  const r = await fetch(PS + "/transaction/verify/" + p.reference, { headers: hdr() });
  const j = await r.json();
  if (j.status && j.data.status === "success" && j.data.amount === Math.round(p.amount * 100)) {
    p.status = "success"; p.paidAt = new Date(); await p.save();
  } else if (j.data && j.data.status === "failed") { p.status = "failed"; await p.save(); }
  res.json({ status: p.status });
});

// Paystack calls this by itself (webhook) - set the URL in the Paystack dashboard
router.post("/webhook", async (req, res) => {
  const sig = req.headers["x-paystack-signature"];
  const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(req.rawBody).digest("hex");
  if (hash !== sig) return res.sendStatus(401);
  const ev = req.body;
  if (ev.event === "charge.success") {
    const p = await Payment.findOne({ reference: ev.data.reference });
    if (p && p.status !== "success" && ev.data.amount === Math.round(p.amount * 100)) {
      p.status = "success"; p.paidAt = new Date(); await p.save();
    }
  }
  res.sendStatus(200);
});

module.exports = router;
