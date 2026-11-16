const mongoose = require("mongoose");

// One manual daily report per school per day, written by the head teacher or administrator
const DailyReportSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  date: { type: String, required: true },          // e.g. 2026-11-16
  classes: [{
    _id: false,
    className: String,
    onRoll: { type: Number, default: 0 },
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    names: { type: String, default: "" }           // names of absentees (optional)
  }],
  fees: {
    school: { type: Number, default: 0 },          // school fees collected
    feeding: { type: Number, default: 0 },         // feeding fee collected
    exam: { type: Number, default: 0 },            // exam fees collected
    other: { type: Number, default: 0 }
  },
  expenses: [{ _id: false, item: { type: String, default: "" }, amount: { type: Number, default: 0 } }],
  notes: { type: String, default: "" },
  writtenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now }
});

DailyReportSchema.index({ schoolId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyReport", DailyReportSchema);
