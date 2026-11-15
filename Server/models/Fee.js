const mongoose = require("mongoose");

// A fee the school charges (tuition, exam fee, PTA, etc.)
const FeeSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  title: { type: String, required: true },        // "Term 1 School Fees", "Mock Exam Fee"
  type: { type: String, enum: ["tuition", "exam", "other"], default: "tuition" },
  amount: { type: Number, required: true },       // in GHS
  className: { type: String, default: "all" },    // "all" or a single class
  dueDate: { type: Date, required: true },        // used by the reminder month limit
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Fee", FeeSchema);
