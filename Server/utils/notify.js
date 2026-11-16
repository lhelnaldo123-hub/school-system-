const Notification = require("../models/Notification");
const PushSub = require("../models/PushSub");
const User = require("../models/User");

// Phone alerts when the app is closed need the "web-push" package and VAPID keys (see README note).
// Without them everything still works inside the app (bell + badge).
let webpush = null;
try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush = require("web-push");
    webpush.setVapidDetails("mailto:" + (process.env.VAPID_EMAIL || "admin@example.com"), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
} catch (e) { console.log("web-push not installed: phone alerts are off (in-app alerts still work)"); webpush = null; }

// Tell some people (by user id): saves the alert and sends a phone push if possible
async function notifyUsers(schoolId, userIds, title, body, page) {
  try {
    const ids = [...new Set((userIds || []).map(String))];
    if (!ids.length) return;
    await Notification.insertMany(ids.map(u => ({ schoolId, userId: u, title, body: body || "", page: page || "home" })));
    if (!webpush) return;
    const subs = await PushSub.find({ userId: { $in: ids } });
    const payload = JSON.stringify({ title, body: body || "", page: page || "home" });
    await Promise.all(subs.map(s => webpush.sendNotification(s.sub, payload).catch(async err => {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) await PushSub.deleteOne({ _id: s._id });
    })));
  } catch (e) { console.error("notify error:", e.message); }
}

// Tell the owner and head teacher(s) of a school
async function notifyStaff(schoolId, title, body, page) {
  const u = await User.find({ schoolId, role: { $in: ["owner", "head"] }, active: true }).select("_id");
  return notifyUsers(schoolId, u.map(x => x._id), title, body, page);
}

module.exports = { notifyUsers, notifyStaff, pushOn: () => !!webpush };
