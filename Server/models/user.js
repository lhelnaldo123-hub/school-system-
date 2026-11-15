const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, default: "" },           // for SMS / WhatsApp, e.g. 0244123456
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["owner", "head", "teacher", "parent"], required: true },
  classes: { type: [String], default: [] },       // classes a teacher handles
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// same email can exist in different schools
UserSchema.index({ schoolId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("User", UserSchema);
