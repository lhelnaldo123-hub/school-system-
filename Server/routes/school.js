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

// "paystack" tells the app whether online card/MoMo payment is switched on
const out = s => Object.assign(s.toObject(), { paystack: !!process.env.PAYSTACK_SECRET_KEY });

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

module.exports = router;
