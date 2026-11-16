const mongoose = require("mongoose");

// One-time registration code. You create it, you give it to ONE owner.
const InviteSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  note: { type: String, default: "" },            // who it is for, e.g. "Mr Mensah - Bright Stars"
  used: { type: Boolean, default: false },
  usedAt: { type: Date },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
  expiresAt: { type: Date },                      // optional
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Invite", InviteSchema);
