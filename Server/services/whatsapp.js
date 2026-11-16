const { sendSMS } = require("./sms");

// WhatsApp Business Cloud API (Meta). Needs WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in Render > Environment.
// Ghana numbers: 0244123456 -> 233244123456
const clean = p => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "233" + d.slice(1);
  else if (d.length === 9) d = "233" + d;
  return d;
};

const whatsappOn = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

async function sendWhatsApp({ to, message, school }) {
  const phone = clean(to);
  if (!phone) return { ok: false, reason: "missing phone" };
  if (!whatsappOn()) return { ok: false, reason: "WhatsApp is not set up on the server" };
  const body = { messaging_product: "whatsapp", to: phone };
  if (process.env.WHATSAPP_TEMPLATE) {
    // A school can message a parent first only with an approved template (one text variable {{1}}).
    // Template parameters cannot contain new lines, so they are turned into spaces.
    body.type = "template";
    body.template = {
      name: process.env.WHATSAPP_TEMPLATE,
      language: { code: process.env.WHATSAPP_LANG || "en" },
      components: [{ type: "body", parameters: [{ type: "text", text: String(message).replace(/\s*\n+\s*/g, " ").replace(/ {2,}/g, " ").slice(0, 900) }] }]
    };
  } else {
    // Plain text only arrives if the parent wrote to the school number in the last 24 hours.
    body.type = "text";
    body.text = { body: String(message).slice(0, 3500), preview_url: false };
  }
  const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.WHATSAPP_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || `WhatsApp request failed (${r.status})`);
  console.log(`[WHATSAPP] ${school || "school"} -> ${phone}`);
  return { ok: true, provider: "whatsapp", response: j };
}

// Send by the chosen channel. If WhatsApp fails and smsFallback is true, the SMS is used instead.
async function deliver({ channel, to, message, school, smsFallback }) {
  if (channel === "whatsapp") {
    try {
      const r = await sendWhatsApp({ to, message, school });
      if (r.ok) return { ok: true, via: "whatsapp" };
      if (!smsFallback) return { ok: false, via: "whatsapp", reason: r.reason };
    } catch (e) {
      console.error("WhatsApp failed:", e.message);
      if (!smsFallback) return { ok: false, via: "whatsapp", reason: e.message };
    }
  }
  try {
    const r = await sendSMS({ to, message, school });
    return { ok: !!r.ok, via: "sms", reason: r.reason };
  } catch (e) { return { ok: false, via: "sms", reason: e.message }; }
}

module.exports = { sendWhatsApp, deliver, whatsappOn, clean };