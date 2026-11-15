const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  name: { type: String, required: true },
  className: { type: String, required: true },    // must match one of school.classes
  gender: { type: String, default: "" },
  photo: { type: String, default: "" },
  parents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // one or both parents
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

StudentSchema.index({ schoolId: 1, className: 1 });

module.exports = mongoose.model("Student", StudentSchema);
