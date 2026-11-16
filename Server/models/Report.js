const mongoose = require("mongoose");

// A report holds one student's results for a term or mock assessment.
// Legacy classScore/examScore fields remain supported by the existing portal.
const ReportSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  className: { type: String, required: true },
  term: { type: String, required: true },
  year: { type: Number, required: true },
  type: { type: String, enum: ["terminal", "mock"], default: "terminal" },
  subjects: [{
    _id: false,
    name: { type: String, required: true },
    classScore: { type: Number, min: 0, max: 50 },
    examScore: { type: Number, min: 0, max: 50 },
    // Optional SBA breakdown: three tests /20, project /10, group work /10.
    tests: { type: [Number], default: undefined },
    project: { type: Number, min: 0, max: 10 },
    groupWork: { type: Number, min: 0, max: 10 },
    rawExamScore: { type: Number, min: 0, max: 100 },
    grade: { type: String, default: "" },
    remark: { type: String, default: "" }
  }],
  remark: { type: String, default: "" },
  headRemark: { type: String, default: "" },
  conduct: { type: String, default: "" },
  attitude: { type: String, default: "" },
  interest: { type: String, default: "" },
  attendance: {
    opened: { type: Number, min: 0 },
    present: { type: Number, min: 0 },
    absent: { type: Number, min: 0 },
    late: { type: Number, min: 0 },
    excused: { type: Number, min: 0 }
  },
  promotedTo: { type: String, default: "" },
  published: { type: Boolean, default: false },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now }
});

ReportSchema.index({ schoolId: 1, studentId: 1, term: 1, year: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Report", ReportSchema);
