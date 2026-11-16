const mongoose = require("mongoose");

// Teacher attendance: one document per school per day. marks = { userId: "P" | "A" | "L" }  (Present, Absent, Late)
const StaffAttendanceSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  date: { type: String, required: true },          // e.g. 2026-11-16
  marks: { type: Object, default: {} }
}, { minimize: false });

StaffAttendanceSchema.index({ schoolId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("StaffAttendance", StaffAttendanceSchema);
