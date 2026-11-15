const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  feeId: { type: mongoose.Schema.Types.ObjectId, ref: "Fee", required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: { type: Number, required: true },      // GHS
  reference: { type: String, required: true, unique: true },
  status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
  method: { type: String, default: "paystack" }, // or "cash" when the school records it
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Payment", PaymentSchema);
