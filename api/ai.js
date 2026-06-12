// Vercel serverless function — keeps the Anthropic API key on the server.
// Surfaces the real upstream error so problems are easy to diagnose.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is missing in Vercel. Add it in Settings → Environment Variables, then redeploy." });
  }

  // Robust body parsing (Vercel may or may not pre-parse JSON depending on setup)
  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      if (typeof body === "string") {
        body = JSON.parse(body);
      } else {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      }
    } catch {
      body = {};
    }
  }

  const { prompt, max_tokens } = body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      // Pass the real Anthropic error message back to the app
      const msg = data?.error?.message || `Anthropic API error (status ${r.status})`;
      return res.status(r.status).json({ error: msg });
    }
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Request to Anthropic failed: " + (e?.message || "unknown") });
  }
}
