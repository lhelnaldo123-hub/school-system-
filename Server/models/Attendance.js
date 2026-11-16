const mongoose = require("mongoose");

// One document per class per school day. marks = { studentId: "P" or "A" }
const AttendanceSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  className: { type: String, required: true },
  term: { type: String, required: true },
  year: { type: Number, required: true },
  date: { type: String, required: true },          // e.g. 2026-11-16
  marks: { type: Object, default: {} }
}, { minimize: false });

AttendanceSchema.index({ schoolId: 1, className: 1, term: 1, year: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);