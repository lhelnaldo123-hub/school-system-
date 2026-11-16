const mongoose = require("mongoose");

// Extra report-card facts for one class in one term.
// cls      = whole class: opened, reopen, vacate, tui, pta, toi
// students = { studentId: { cd, at, it, tr, hr, promo, arr, days } }
const TermMetaSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  className: { type: String, required: true },
  term: { type: String, required: true },
  year: { type: Number, required: true },
  cls: { type: Object, default: {} },
  students: { type: Object, default: {} }
}, { minimize: false });

TermMetaSchema.index({ schoolId: 1, className: 1, term: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("TermMeta", TermMetaSchema);