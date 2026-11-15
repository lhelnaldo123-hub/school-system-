const mongoose = require("mongoose");

const NoticeSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  audience: { type: String, enum: ["all", "parents", "teachers"], default: "all" },
  className: { type: String, default: "all" },     // "all" or one class
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notice", NoticeSchema);
