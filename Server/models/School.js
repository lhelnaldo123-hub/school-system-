const mongoose = require("mongoose");

const SchoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g. "tscs"
  motto: { type: String, default: "" },
  logo: { type: String, default: "" },            // image URL or base64
  invoiceName: { type: String, default: "" },     // name printed on receipts/invoices
  reportTheme: { type: String, default: "y" },    // report card colour: y b p c g v o s
  email: { type: String, default: "" },
  website: { type: String, default: "" },
  signature: { type: String, default: "" },       // head teacher's signature picture
  lists: { type: Object, default: {} },
  // Mobile money number parents pay to (manual MoMo payments with screenshot proof)
  momo: {
    network: { type: String, default: "MTN MoMo" },
    number: { type: String, default: "" },
    name: { type: String, default: "" },
    note: { type: String, default: "" },
    // optional second number (for example Telecel/Vodafone Cash)
    network2: { type: String, default: "" },
    number2: { type: String, default: "" },
    name2: { type: String, default: "" }
  },
  // The school's own report card picture + handwriting style
  reportTpl: {
    img: { type: String, default: "" },           // A4 picture (base64)
    top: { type: Number, default: 40 },           // mm from the top where the content starts
    side: { type: Number, default: 10 },          // mm left/right margin
    hideHead: { type: Boolean, default: true }    // hide the app's own school header
  },
  ink: {
    font: { type: String, default: "Caveat" },
    color: { type: String, default: "" }
  },           // ready-made conduct / attitude / interest / remark lists
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
  subjects: {
    type: [String],
    default: ["English Language", "Mathematics", "Integrated Science", "Social Studies", "RME",
      "Computing", "Creative Arts", "Ghanaian Language", "French"]
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