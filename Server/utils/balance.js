const Fee = require("../models/Fee");
const Payment = require("../models/Payment");

// Returns every fee a student owes with how much is paid and left.
// Fees of the student's old classes (created before they moved up) stay on the list until paid.
async function studentFees(student) {
  const old = (student.classHistory || []).map(h => ({ className: h.className, createdAt: { $lte: h.until } }));
  const fees = await Fee.find({
    schoolId: student.schoolId,
    $or: [{ className: { $in: ["all", student.className] } }].concat(old)
  }).sort({ dueDate: 1 });

  const pays = await Payment.find({ studentId: student._id, status: "success" });
  const paidByFee = {};
  pays.forEach(p => { paidByFee[p.feeId] = (paidByFee[p.feeId] || 0) + p.amount; });

  return fees.map(f => {
    const paid = paidByFee[f._id] || 0;
    return {
      feeId: f._id, title: f.title, type: f.type, amount: f.amount, className: f.className,
      carried: f.className !== "all" && f.className !== student.className,
      dueDate: f.dueDate, paid, balance: Math.max(0, f.amount - paid)
    };
  });
}

module.exports = { studentFees };
