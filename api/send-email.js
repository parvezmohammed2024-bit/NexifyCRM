// Sends email via Resend. Used for new-assignment emails and the "Send now" button.
// Requires RESEND_API_KEY in Vercel env. Sender domain should be verified in Resend.
const FROM = process.env.EMAIL_FROM || "Nexify CRM <onboarding@resend.dev>";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: "RESEND_API_KEY is missing in Vercel. Add it in Settings → Environment Variables, then redeploy." });

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      if (typeof body === "string") body = JSON.parse(body);
      else {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      }
    } catch { body = {}; }
  }

  const { to, subject, html } = body || {};
  if (!to || !subject || !html) return res.status(400).json({ error: "Missing to/subject/html" });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.message || `Resend error ${r.status}` });
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: "Email send failed: " + (e?.message || "unknown") });
  }
}
