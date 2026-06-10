// Vercel serverless function — keeps the Anthropic API key on the server.
// The browser never sees the key.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "AI is not configured. Add ANTHROPIC_API_KEY in Vercel settings." });
  }
  try {
    const { prompt, max_tokens } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

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
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "AI request failed" });
  }
}
