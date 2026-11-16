const cron = require("node-cron");
const School = require("../models/School");
const Student = require("../models/Student");
const User = require("../models/User");
const { studentFees } = require("../utils/balance");
const { sendSMS } = require("../services/sms");

const sent = new Map();

const clearOldKeys = () => {
  const now = Date.now();
  for (const [key, ts] of sent.entries()) {
    if (now - ts > 1000 * 60 * 60 * 24) sent.delete(key);
  }
};

const formatMessage = (message, values) => {
  return (message || "Dear parent, {student} owes {amount} at {school}. Please pay via the school app. Thank you.")
    .replace(/\{student\}/gi, values.student || "student")
    .replace(/\{amount\}/gi, values.amount || "0")
    .replace(/\{school\}/gi, values.school || "school");
};

const buildReminderList = async (school) => {
  const students = await Student.find({ schoolId: school._id, active: true }).populate("parents", "name phone");
  const reminders = [];

  for (const student of students) {
    const parents = (student.parents || []).filter(p => p && p.phone);
    if (!parents.length) continue;

    const fees = await studentFees(student);
    const owed = fees.reduce((sum, fee) => sum + fee.balance, 0);
    if (owed <= 0) continue;

    const oldestDue = fees
      .filter(f => f.balance > 0 && f.dueDate)
      .reduce((oldest, fee) => {
        const due = new Date(fee.dueDate).getTime();
        return !oldest || due < oldest ? due : oldest;
      }, null);

    const monthsLimit = Number(school.reminder?.monthsLimit || 1);
    const dueMonthsAgo = oldestDue ? (Date.now() - oldestDue) / (1000 * 60 * 60 * 24 * 30) : 0;
    if (oldestDue && dueMonthsAgo < monthsLimit) continue;

    for (const parent of parents) {
      reminders.push({
        parentId: parent._id,
        parentName: parent.name,
        phone: parent.phone,
        student: student.name,
        amount: `GHS ${(owed || 0).toFixed(2)}`,
        className: student.className,
        message: formatMessage(school.reminder?.message || "Dear parent, {student} owes {amount} at {school}. Please pay via the school app. Thank you.", {
          student: student.name,
          amount: `GHS ${(owed || 0).toFixed(2)}`,
          school: school.name
        })
      });
    }
  }

  return reminders;
};

const run = async () => {
  clearOldKeys();
  const schools = await School.find({ "reminder.enabled": true });

  for (const school of schools) {
    try {
      const reminders = await buildReminderList(school);
      for (const item of reminders) {
        const key = `${school._id}:${item.parentId}:${item.student}:${item.amount}`;
        if (sent.has(key)) continue;

        const result = await sendSMS({
          to: item.phone,
          message: item.message,
          school: school.name
        });

        if (result.ok) {
          sent.set(key, Date.now());
          console.log(`[Reminder] sent to ${item.parentName || item.phone} for ${item.student}`);
        }
      }
    } catch (err) {
      console.error("Reminder job failed:", err.message);
    }
  }
};

const startJobs = () => {
  cron.schedule("0 8 * * *", run);
  console.log("Fee reminder job started");
};

module.exports = { startJobs, run };
