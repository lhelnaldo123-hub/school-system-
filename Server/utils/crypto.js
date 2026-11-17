// utils/crypto.js - locks and unlocks secrets (like a school's Paystack key) before they go into the database.
// The lock key comes from ENC_KEY on Render (or JWT_SECRET if ENC_KEY is not set).
// If you change that value later, saved Paystack keys can no longer be read and owners must paste them again.
const crypto = require("crypto");

const lockKey = () => crypto.createHash("sha256").update(String(process.env.ENC_KEY || process.env.JWT_SECRET || "")).digest();

function enc(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", lockKey(), iv);
  const data = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

function dec(packed) {
  try {
    const [iv, tag, data] = String(packed || "").split(":");
    if (!data) return "";
    const d = crypto.createDecipheriv("aes-256-gcm", lockKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch (e) { return ""; }
}

module.exports = { enc, dec };
