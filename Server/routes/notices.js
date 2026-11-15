const router = require("express").Router();
const Notice = require("../models/Notice");
const Student = require("../models/Student");
const auth = require("../middleware/auth");

// Head/owner posts a notice (to everyone, parents only, teachers only, or one class)
router.post("/", auth(["owner", "head"]), async (req, res) => {
  try {
    const { title, body, audience, className } = req.body;
    if (!title) return res.status(400).json({ error: "Write a title" });
    res.json(await Notice.create({
      schoolId: req.user.schoolId, title, body, audience: audience || "all",
      className: className || "all", createdBy: req.user.id
    }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Everyone reads the notices meant for them
router.get("/", auth(), async (req, res) => {
  const q = { schoolId: req.user.schoolId };
  if (req.user.role === "parent") {
    const kids = await Student.find({ schoolId: req.user.schoolId, parents: req.user.id }).select("className");
    q.audience = { $in: ["all", "parents"] };
    q.className = { $in: ["all", ...kids.map(k => k.className)] };
  } else if (req.user.role === "teacher") {
    q.audience = { $in: ["all", "teachers"] };
  }
  res.json(await Notice.find(q).sort({ createdAt: -1 }).limit(50));
});

router.delete("/:id", auth(["owner", "head"]), async (req, res) => {
  await Notice.deleteOne({ _id: req.params.id, schoolId: req.user.schoolId });
  res.json({ ok: true });
});

module.exports = router;
