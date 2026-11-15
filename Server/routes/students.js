const router = require("express").Router();
const Student = require("../models/Student");
const User = require("../models/User");
const auth = require("../middleware/auth");

// Add a student (head/owner/teacher). parentIds can hold one or both parents.
router.post("/", auth(["owner", "head", "teacher"]), async (req, res) => {
  try {
    const { name, className, gender, parentIds } = req.body;
    const s = await Student.create({
      schoolId: req.user.schoolId, name, className, gender, parents: parentIds || []
    });
    res.json(s);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Staff list students (optionally one class)
router.get("/", auth(["owner", "head", "teacher"]), async (req, res) => {
  const q = { schoolId: req.user.schoolId, active: true };
  if (req.query.className) q.className = req.query.className;
  res.json(await Student.find(q).populate("parents", "name phone").sort({ name: 1 }));
});

// Parent: ALL their children, in any class
router.get("/mine", auth(["parent"]), async (req, res) => {
  res.json(await Student.find({ schoolId: req.user.schoolId, parents: req.user.id, active: true }));
});

// Link or change parents / class of a student
router.put("/:id", auth(["owner", "head"]), async (req, res) => {
  const upd = {};
  ["name", "className", "gender", "parents", "active"].forEach(k => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
  res.json(await Student.findOneAndUpdate({ _id: req.params.id, schoolId: req.user.schoolId }, upd, { new: true }));
});

module.exports = router;
