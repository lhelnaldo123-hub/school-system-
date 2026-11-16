const mongoose = require("mongoose");

// One alert for one person (shown under the bell in the app)
const NotificationSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  page: { type: String, default: "home" },      // app page to open when tapped
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
