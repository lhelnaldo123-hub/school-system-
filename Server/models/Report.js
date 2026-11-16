const mongoose = require("mongoose");

// One report per student per term/year/type. Teachers add one subject at a time.
// type: "terminal", or "mock1" ... "mock7" (SBA mock exams). Old "mock" reports are kept too.
const ReportSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  className: { type: String, required: true },
  term: { type: String, required: true },          // "Term 1", "Term 2", "Term 3"
  year: { type: Number, required: true },
  type: { type: String, default: "terminal" },
  subjects: [{
    _id: false,
    name: String,
    classScore: Number,                            // out of 50 (worked out from the SBA boxes)
    examScore: Number,                             // out of 50
    raw: [Number],                                 // SBA boxes: test1/20, test2/20, test3/20, project/10, group/10, exam/100
    score: Number                                  // mock exam score out of 100
  }],
  remark: { type: String, default: "" },
  published: { type: Boolean, default: false },    // parents see it only when published
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now }
});

ReportSchema.index({ schoolId: 1, studentId: 1, term: 1, year: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Report", ReportSchema);