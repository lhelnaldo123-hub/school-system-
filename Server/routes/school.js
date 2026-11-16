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

router.get("/mine", auth(), async (req, res) => {
  res.json(await School.findById(req.user.schoolId));
});

// Owner changes school name, colours, logo, motto, classes, invoice name, reminder settings
router.put("/mine", auth(["owner"]), async (req, res) => {
  const allowed = ["name", "motto", "logo", "invoiceName", "address", "phone", "colors", "reportTheme", "email", "website", "classes", "subjects", "reminder"];
  const upd = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
  res.json(await School.findByIdAndUpdate(req.user.schoolId, upd, { new: true }));
});

module.exports = router;
