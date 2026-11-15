const mongoose = require("mongoose");

// One report per student per term/year/type. Teachers add one subject at a time.
const ReportSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  className: { type: String, required: true },
  term: { type: String, required: true },          // "Term 1", "Term 2", "Term 3"
  year: { type: Number, required: true },
  type: { type: String, enum: ["terminal", "mock"], default: "terminal" },
  subjects: [{
    _id: false,
    name: String,
    classScore: Number,                            // out of 50
    examScore: Number                              // out of 50
  }],
  remark: { type: String, default: "" },
  published: { type: Boolean, default: false },    // parents see it only when published
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now }
});

ReportSchema.index({ schoolId: 1, studentId: 1, term: 1, year: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Report", ReportSchema);
