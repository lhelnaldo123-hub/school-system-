const router = require("express").Router();
const School = require("../models/School");
const auth = require("../middleware/auth");

// Public: loading page + login screen read the school's name, logo, colours, motto
router.get("/public/:code", async (req, res) => {
  const s = await School.findOne({ code: req.params.code.toLowerCase() })
    .select("name code motto logo colors invoiceName");
  if (!s) return res.status(404).json({ error: "School not found" });
  res.json(s);
});

const { enc } = require("../utils/crypto");

// "paystack" tells the app whether THIS school has added its own Paystack key (online card/MoMo payment is on)
const out = s => { const o = s.toObject(); delete o.paystackKey; return Object.assign(o, { paystack: !!(o.paystackInfo && o.paystackInfo.last4) }); };

router.get("/mine", auth(), async (req, res) => {
  res.json(out(await School.findById(req.user.schoolId)));
});

// Owner changes school name, colours, logo, motto, classes, invoice name, reminder settings
router.put("/mine", auth(["owner"]), async (req, res) => {
  const allowed = ["name", "motto", "logo", "invoiceName", "address", "phone", "colors", "reportTheme", "reportLayout", "email", "website", "classes", "subjects", "reminder", "momo", "ink"];
  const upd = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
  // report template: change only the parts that were sent (the big picture is sent only when it changes)
  if (req.body.reportTpl) ["img", "top", "side", "bot", "hideHead"].forEach(k => { if (req.body.reportTpl[k] !== undefined) upd["reportTpl." + k] = req.body.reportTpl[k]; });
  res.json(out(await School.findByIdAndUpdate(req.user.schoolId, upd, { new: true })));
});

// ---------- Paystack: each school pastes its OWN secret key ----------
// The key is checked with Paystack, then saved locked. It is never sent back.
const webhookUrl = req => (process.env.API_URL || ("https://" + req.get("host"))).replace(/\/$/, "") + "/api/paystack/webhook";

router.get("/mine/paystack", auth(["owner", "head"]), async (req, res) => {
  const s = await School.findById(req.user.schoolId).select("paystackInfo");
  const i = (s && s.paystackInfo) || {};
  res.json({ on: !!i.last4, mode: i.mode || "", last4: i.last4 || "", webhook: webhookUrl(req) });
});

router.put("/mine/paystack", auth(["owner"]), async (req, res) => {
  const k = String(req.body.secret || "").trim();
  if (/^pk_/.test(k)) return res.status(400).json({ error: "That is the PUBLIC key (pk_). Please paste the SECRET key that starts with sk_test_ or sk_live_." });
  if (!/^sk_(test|live)_[A-Za-z0-9]{10,}$/.test(k)) return res.status(400).json({ error: "That does not look like a Paystack secret key. It starts with sk_test_ or sk_live_." });
  let r;
  try { r = await fetch("https://api.paystack.co/balance", { headers: { Authorization: "Bearer " + k } }); }
  catch (e) { return res.status(502).json({ error: "Could not reach Paystack. Try again in a moment." }); }
  if (r.status === 401) return res.status(400).json({ error: "Paystack did not accept that key. Copy it again from your Paystack dashboard." });
  if (!r.ok) return res.status(400).json({ error: "Paystack answered with a problem (code " + r.status + "). Check the key and try again." });
  const mode = k.startsWith("sk_live_") ? "live" : "test";
  await School.findByIdAndUpdate(req.user.schoolId, { paystackKey: enc(k), paystackInfo: { mode, last4: k.slice(-4), setAt: new Date() } });
  res.json({ on: true, mode, last4: k.slice(-4), webhook: webhookUrl(req) });
});

router.delete("/mine/paystack", auth(["owner"]), async (req, res) => {
  await School.findByIdAndUpdate(req.user.schoolId, { paystackKey: "", paystackInfo: { mode: "", last4: "" } });
  res.json({ on: false, mode: "", last4: "", webhook: webhookUrl(req) });
});

module.exports = router;
