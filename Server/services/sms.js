async function sendSMS({ to, message, school }) {
  const phone = String(to || "").trim();
  if (!phone) return { ok: false, reason: "missing phone" };
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase();
  if (!provider) {
    console.log(`[SMS LOG] ${school || "school"}: ${phone} => ${message}`);
    return { ok: true, provider: "log" };
  }
  if (provider === "arkesel") {
    if (!process.env.ARKESEL_API_KEY) throw new Error("ARKESEL_API_KEY is not configured");
    const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": process.env.ARKESEL_API_KEY },
      body: JSON.stringify({ sender: process.env.SMS_SENDER_ID || "SchoolApp", message, recipients: [phone] })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Arkesel request failed (${response.status})`);
    return { ok: true, provider, response: data };
  }
  if (provider === "hubtel") {
    if (!process.env.HUBTEL_CLIENT_ID || !process.env.HUBTEL_CLIENT_SECRET) throw new Error("Hubtel credentials are not configured");
    const response = await fetch("https://api.hubtel.com/v1/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${process.env.HUBTEL_CLIENT_ID}:${process.env.HUBTEL_CLIENT_SECRET}`).toString("base64")}`
      },
      body: JSON.stringify({ From: process.env.SMS_SENDER_ID || "SchoolApp", To: phone, Content: message })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Hubtel request failed (${response.status})`);
    return { ok: true, provider, response: data };
  }
  throw new Error(`Unsupported SMS_PROVIDER: ${provider}`);
}
module.exports = { sendSMS };
