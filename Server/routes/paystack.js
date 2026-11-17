const router = require("express").Router();
const crypto = require("crypto");
const Payment = require("../models/Payment");
const Fee = require("../models/Fee");
const Student = require("../models/Student");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { studentFees } = require("../utils/balance");
const { notifyUsers, notifyStaff } = require("../utils/notify");
const { schoolKey } = require("../utils/pskey");

// Tell the head/owner and the parent that an online payment came in
async function paidAlert(p) {
  const [st, fee] = await Promise.all([Student.findById(p.studentId).select("name"), Fee.findById(p.feeId).select("title")]);
  notifyStaff(p.schoolId, "💳 Payment received", "GHS " + p.amount.toFixed(2) + " paid online for " + (st ? st.name : "a student") + (fee ? " (" + fee.title + ")" : "") + ".", "owing");
  if (p.parentId) notifyUsers(p.schoolId, [p.parentId], "✅ Payment successful", "Your payment of GHS " + p.amount.toFixed(2) + " was received.", "history");
}

const PS = "https://api.paystack.co";
// Every school uses ITS OWN Paystack key (saved by the owner in School settings), so the money goes to that school.
const hdr = key => ({ Authorization: "Bearer " + key, "Content-Type": "application/json" });

// Parent starts a payment for one child + one fee
router.post("/init", auth(["parent"]), async (req, res) => {
  let created = null;
  try {
    const key = await schoolKey(req.user.schoolId);
    if (!key) return res.status(400).json({ error: "Online payment is not switched on for this school. Please pay by Mobile Money or at the school office." });

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

    created = await Payment.create({
      schoolId: req.user.schoolId, studentId, feeId, parentId: req.user.id,
      amount: pay, reference, status: "pending"
    });

    const r = await fetch(PS + "/transaction/initialize", {
      method: "POST", headers: hdr(key),
      body: JSON.stringify({
        email: parent.email, amount: Math.round(pay * 100), currency: "GHS", reference,
        callback_url: (process.env.FRONTEND_URL || "") + "/?paid=" + reference,
        metadata: { studentId, feeId }
      })
    });
    const j = await r.json();
    if (!j.status) { await Payment.deleteOne({ _id: created._id }); return res.status(400).json({ error: j.message || "Paystack error" }); }
    res.json({ url: j.data.authorization_url, reference });
  } catch (e) {
    if (created) { try { await Payment.deleteOne({ _id: created._id, status: "pending" }); } catch (x) { } }
    res.status(500).json({ error: e.message });
  }
});

// Frontend calls this after Paystack sends the parent back
router.get("/verify/:reference", auth(["parent"]), async (req, res) => {
  try {
    const p = await Payment.findOne({ reference: req.params.reference, parentId: req.user.id });
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.status === "success") return res.json({ status: "success" });
    const key = await schoolKey(p.schoolId);
    if (!key) return res.json({ status: p.status });
    const r = await fetch(PS + "/transaction/verify/" + p.reference, { headers: hdr(key) });
    const j = await r.json();
    if (j.status && j.data && j.data.status === "success" && j.data.amount === Math.round(p.amount * 100)) {
      p.status = "success"; p.paidAt = new Date(); await p.save(); paidAlert(p).catch(() => { });
    } else if (j.data && j.data.status === "failed") { p.status = "failed"; await p.save(); }
    res.json({ status: p.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Paystack calls this by itself (webhook). ONE link works for every school:
// we find the payment by its reference, then check Paystack's signature with THAT school's own key.
router.post("/webhook", async (req, res) => {
  try {
    const sig = String(req.headers["x-paystack-signature"] || "");
    let ev = req.body;
    if (!ev || !ev.data) { try { ev = JSON.parse(req.rawBody.toString("utf8")); } catch (e) { return res.sendStatus(400); } }
    const p = ev.data && ev.data.reference ? await Payment.findOne({ reference: ev.data.reference }) : null;
    if (!p) return res.sendStatus(200);                      // not a payment of ours: ignore it
    const key = await schoolKey(p.schoolId);
    if (!key) return res.sendStatus(401);
    const hash = crypto.createHmac("sha512", key).update(req.rawBody).digest("hex");
    const a = Buffer.from(hash), b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.sendStatus(401);
    if (ev.event === "charge.success" && p.status !== "success" && ev.data.amount === Math.round(p.amount * 100)) {
      p.status = "success"; p.paidAt = new Date(); await p.save(); paidAlert(p).catch(() => { });
    }
    res.sendStatus(200);
  } catch (e) { res.sendStatus(500); }
});

module.exports = router;
