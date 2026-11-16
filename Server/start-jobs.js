const fs = require("fs");
const path = require("path");

const app = require("express")();

const jobFile = path.join(__dirname, "jobs", "reminder.js");
if (fs.existsSync(jobFile)) {
  try {
    const job = require(jobFile);
    if (job && typeof job.startJobs === "function") job.startJobs();
  } catch (e) {
    console.error("Reminder startup failed:", e.message);
  }
}

module.exports = app;
