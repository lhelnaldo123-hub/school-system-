const router = require("express").Router();
const Notification = require("../models/Notification");
const PushSub = require("../models/PushSub");
const auth = require("../middleware/auth");
const { pushOn } = require("../utils/notify");

// My latest alerts + how many are unread
router.get("/", auth(), async (req, res) => {
  const [list, unread] = await Promise.all([
    Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(40),
    Notification.countDocuments({ userId: req.user.id, read: false })
  ]);
  res.json({ unread, list, push: pushOn() });
});

// Mark one (id) or all as read
router.post("/read", auth(), async (req, res) => {
  const q = { userId: req.user.id };
  if (req.body.id) q._id = req.body.id;
  await Notification.updateMany(q, { read: true });
  res.json({ ok: true });
});

// Public key the phone needs to subscribe to alerts
router.get("/key", auth(), (req, res) => res.json({ key: pushOn() ? process.env.VAPID_PUBLIC_KEY : "" }));

router.post("/subscribe", auth(), async (req, res) => {
  const sub = req.body.sub;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: "Bad subscription" });
  await PushSub.findOneAndUpdate({ endpoint: sub.endpoint }, { schoolId: req.user.schoolId, userId: req.user.id, sub }, { upsert: true });
  res.json({ ok: true });
});

router.post("/unsubscribe", auth(), async (req, res) => {
  if (req.body.endpoint) await PushSub.deleteOne({ endpoint: req.body.endpoint, userId: req.user.id });
  res.json({ ok: true });
});

module.exports = router;
