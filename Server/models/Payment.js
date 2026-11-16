const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  feeId: { type: mongoose.Schema.Types.ObjectId, ref: "Fee", required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: { type: Number, required: true },      // GHS
  reference: { type: String, required: true, unique: true },
  status: { type: String, enum: ["pending", "review", "success", "failed", "rejected"], default: "pending" },
  method: { type: String, default: "paystack" }, // "cash" (school records it) or "momo" (parent sends a screenshot)
  txnId: { type: String, default: "" },          // MoMo transaction ID typed by the parent
  payerNumber: { type: String, default: "" },
  proof: { type: String, default: "" },          // screenshot (base64)
  reason: { type: String, default: "" },         // why a MoMo payment was rejected
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  decidedAt: { type: Date },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Payment", PaymentSchema);
