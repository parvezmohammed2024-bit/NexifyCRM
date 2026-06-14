// Scheduled by Vercel Cron (see vercel.json). Runs server-side with no browser,
// so it reads the CRM data with the Supabase SERVICE ROLE key (bypasses RLS),
// then emails each team member a digest of their open tasks.
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET (optional).
const FROM = process.env.EMAIL_FROM || "Nexify CRM <onboarding@resend.dev>";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default async function handler(req, res) {
  // Protect: Vercel Cron sends this Authorization header when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_KEY) {
    return res.status(500).json({ error: "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or RESEND_API_KEY" });
  }

  try {
    // Read the single CRM data row via the REST API using the service role key
    const dr = await fetch(`${SUPABASE_URL}/rest/v1/crm_data?id=eq.1&select=data`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const rows = await dr.json();
    const d = (rows && rows[0] && rows[0].data) || {};
    const clients = d.clients || [];
    const generalTasks = d.generalTasks || [];
    const profiles = d.profiles || {};
    const leads = d.leads || [];
    const goals = d.goals || { leadsTarget: 0, dealsTarget: 0 };

    // Monthly goal progress for the email banner
    const monthPrefix = todayStr().slice(0, 7);
    const leadsThisMonth = leads.filter((l) => (l.createdAt || "").slice(0, 7) === monthPrefix).length;
    const dealsWonThisMonth = leads.filter((l) => (l.wonAt || "").slice(0, 7) === monthPrefix).length;
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    const hasGoal = goals.leadsTarget > 0 || goals.dealsTarget > 0;
    const goalBanner = hasGoal
      ? `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:14px;color:#3730a3;">
          📊 <b>This month:</b> ${goals.leadsTarget > 0 ? `${leadsThisMonth}/${goals.leadsTarget} new leads` : ""}${goals.leadsTarget > 0 && goals.dealsTarget > 0 ? " &middot; " : ""}${goals.dealsTarget > 0 ? `${dealsWonThisMonth}/${goals.dealsTarget} deals won` : ""} &middot; ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left
        </div>`
      : "";

    // Gather all open tasks by assignee
    const tasks = [];
    clients.forEach((c) => (c.tasks || []).forEach((t) => tasks.push({ ...t, who: c.company || c.name })));
    generalTasks.forEach((t) => tasks.push({ ...t, who: "General" }));

    const today = todayStr();
    const byUser = {};
    tasks.forEach((t) => {
      if (t.done || !t.assignee) return;
      (byUser[t.assignee] = byUser[t.assignee] || []).push(t);
    });

    const nameOf = (email) => (profiles[email] && profiles[email].name) || email.split("@")[0];
    let sent = 0;

    for (const email of Object.keys(byUser)) {
      const list = byUser[email];
      const overdue = list.filter((t) => t.due && t.due < today);
      const rows = list
        .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
        .map((t) => {
          const late = t.due && t.due < today;
          return `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${t.type || "Task"}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${(t.title || t.text || "").replace(/</g, "&lt;")}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${t.who}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${late ? "#dc2626" : "#666"};">${t.due || "—"}${late ? " (overdue)" : ""}</td>
          </tr>`;
        }).join("");

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <h2 style="color:#4f46e5;">Hi ${nameOf(email)}, here are your tasks</h2>
          ${goalBanner}
          <p style="color:#555;">You have <b>${list.length}</b> open task${list.length !== 1 ? "s" : ""}${overdue.length ? `, including <b style="color:#dc2626;">${overdue.length} overdue</b>` : ""}.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="text-align:left;color:#999;font-size:12px;">
              <th style="padding:6px 10px;">Type</th><th style="padding:6px 10px;">Task</th><th style="padding:6px 10px;">For</th><th style="padding:6px 10px;">Due</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:20px;"><a href="https://nexify-crm.vercel.app" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Open Nexify CRM</a></p>
        </div>`;

      const er = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({ from: FROM, to: [email], subject: `Your tasks — ${overdue.length ? `${overdue.length} overdue` : `${list.length} open`}`, html }),
      });
      if (er.ok) sent++;
    }
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    return res.status(500).json({ error: "Cron failed: " + (e?.message || "unknown") });
  }
}
