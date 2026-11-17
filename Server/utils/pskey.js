// utils/pskey.js - gets a school's own Paystack secret key (empty text if the school has not added one)
const School = require("../models/School");
const { dec } = require("./crypto");

async function schoolKey(schoolId) {
  const s = await School.findById(schoolId).select("+paystackKey");
  return s && s.paystackKey ? dec(s.paystackKey) : "";
}

module.exports = { schoolKey };
