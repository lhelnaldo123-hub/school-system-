const mongoose = require("mongoose");

const SchoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g. "tscs"
  motto: { type: String, default: "" },
  logo: { type: String, default: "" },            // image URL or base64
  invoiceName: { type: String, default: "" },     // name printed on receipts/invoices
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  colors: {
    primary: { type: String, default: "#0b2a8f" },
    accent: { type: String, default: "#f5b800" }
  },
  classes: {
    type: [String],
    default: ["Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
      "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
      "Grade 6", "Grade 7", "Grade 8", "Grade 9"]
  },
  // Fee reminder settings (owner can change)
  reminder: {
    enabled: { type: Boolean, default: false },
    channel: { type: String, enum: ["sms", "whatsapp"], default: "sms" },
    monthsLimit: { type: Number, default: 1 },    // remind when owing from this many months back
    dayOfMonth: { type: Number, default: 1 },     // which day to send
    message: { type: String, default: "Dear parent, {student} owes GHS {amount} at {school}. Please pay via the school app. Thank you." }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("School", SchoolSchema);
