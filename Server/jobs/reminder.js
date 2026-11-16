const cron = require("node-cron");
const School = require("../models/School");
const Student = require("../models/Student");
const { studentFees } = require("../utils/balance");
const { deliver } = require("../services/whatsapp");

const sent = new Map();

const clearOldKeys = () => {
  const now = Date.now();
  for (const [key, ts] of sent.entries()) {
    if (now - ts > 1000 * 60 * 60 * 24) sent.delete(key);
  }
};

// {amount} becomes "GHS 120.00" (and an old "GHS {amount}" in a saved message does not print GHS twice)
const formatMessage = (message, v) =>
  (message || "Dear parent, {student} owes {amount} at {school}. Please pay via the school app. Thank you.")
    .replace(/GHS\s*\{amount\}/gi, "{amount}")
    .replace(/\{student\}/gi, v.student || "student")
    .replace(/\{amount\}/gi, v.amount || "GHS 0.00")
    .replace(/\{school\}/gi, v.school || "school");

// What one student owes, as a ready message (null when nothing is owed)
async function messageFor(school, student) {
  const fees = await studentFees(student);
  const owed = fees.reduce((sum, f) => sum + f.balance, 0);
  if (owed <= 0) return null;
  return {
    owed, fees,
    message: formatMessage(school.reminder && school.reminder.message, { student: student.name, amount: "GHS " + owed.toFixed(2), school: school.name })
  };
}

const buildReminderList = async (school) => {
  const students = await Student.find({ schoolId: school._id, active: true }).populate("parents", "name phone");
  const reminders = [];
  for (const student of students) {
    const parents = (student.parents || []).filter(p => p && p.phone);
    if (!parents.length) continue;
    const m = await messageFor(school, student);
    if (!m) continue;

    const oldestDue = m.fees
      .filter(f => f.balance > 0 && f.dueDate)
      .reduce((oldest, fee) => {
        const due = new Date(fee.dueDate).getTime();
        return !oldest || due < oldest ? due : oldest;
      }, null);
    const monthsLimit = Number((school.reminder && school.reminder.monthsLimit) || 1);
    const dueMonthsAgo = oldestDue ? (Date.now() - oldestDue) / (1000 * 60 * 60 * 24 * 30) : 0;
    if (oldestDue && dueMonthsAgo < monthsLimit) continue;

    for (const parent of parents)
      reminders.push({ parentId: parent._id, parentName: parent.name, phone: parent.phone, student: student.name, amount: "GHS " + m.owed.toFixed(2), message: m.message });
  }
  return reminders;
};

// Send the reminders of one school. force = true ignores the "already sent today" check.
async function runSchool(school, force) {
  const channel = (school.reminder && school.reminder.channel) || "sms";
  const list = await buildReminderList(school);
  const out = { total: list.length, sent: 0, failed: 0, channel };
  for (const item of list) {
    const key = `${school._id}:${item.parentId}:${item.student}:${item.amount}`;
    if (!force && sent.has(key)) continue;
    const r = await deliver({ channel, to: item.phone, message: item.message, school: school.name, smsFallback: true });
    if (r.ok) { sent.set(key, Date.now()); out.sent++; console.log(`[Reminder] ${r.via} to ${item.parentName || item.phone} for ${item.student}`); }
    else { out.failed++; console.error(`[Reminder] failed for ${item.parentName || item.phone}: ${r.reason}`); }
  }
  return out;
}

const run = async () => {
  clearOldKeys();
  const today = new Date().getDate();
  const schools = await School.find({ "reminder.enabled": true });
  for (const school of schools) {
    if (today !== Number((school.reminder && school.reminder.dayOfMonth) || 1)) continue;   // only on the chosen day
    try { await runSchool(school, false); }
    catch (err) { console.error("Reminder job failed:", err.message); }
  }
};

const startJobs = () => {
  cron.schedule("0 8 * * *", run);
  console.log("Fee reminder job started");
};

module.exports = { startJobs, run, runSchool, messageFor, formatMessage, buildReminderList };