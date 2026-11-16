require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

// Paystack webhook needs the raw body, so keep a copy of it
app.use(express.json({
  limit: "5mb",
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

app.get("/", (req, res) => res.json({ ok: true, name: "School System API" }));

// Auto-load every file in /routes as /api/<filename>
// e.g. routes/auth.js -> /api/auth
const routesDir = path.join(__dirname, "routes");
if (fs.existsSync(routesDir)) {
  fs.readdirSync(routesDir)
    .filter(f => f.endsWith(".js"))
    .forEach(f => {
      const name = f.replace(".js", "");
      app.use("/api/" + name, require(path.join(routesDir, f)));
      console.log("Loaded route /api/" + name);
    });
}

// Start the fee reminder job if the file exists (added in step 4)
const jobFile = path.join(__dirname, "jobs", "reminder.js");
if (fs.existsSync(jobFile)) {
  const job = require(jobFile);
  if (job && typeof job.startJobs === "function") job.startJobs();   // starts the daily fee reminders
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log("Server running on " + PORT));
  })
  .catch(e => { console.error("MongoDB error:", e.message); process.exit(1); });
