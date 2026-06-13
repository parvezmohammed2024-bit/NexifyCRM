# Nexify CRM — Setup Guide (no coding needed)

You'll do 3 things: set up the database (Supabase), put the code online (GitHub),
and publish the site (Vercel). About 20–30 minutes. Take it step by step.

────────────────────────────────────────
## PART 1 — Supabase (your database + logins)
────────────────────────────────────────
1. Go to https://supabase.com → sign in → "New project".
   - Name: nexify-crm   • Pick a strong database password • Region: closest to you.
2. Wait ~2 minutes for it to finish setting up.
3. Left menu → "SQL Editor" → "New query".
4. Open the file `supabase-schema.sql` (included), copy ALL of it, paste, click "Run".
   You should see "Success".
5. Create your team's logins: left menu → "Authentication" → "Users" → "Add user"
   → "Create new user". Enter each person's email + a password. Do this for yourself
   and each team member (e.g. Rubina). Tick "Auto Confirm User".
6. Get your keys: left menu → "Project Settings" → "API". Copy these two — you'll
   need them in Part 3:
   - Project URL   (looks like https://abcd1234.supabase.co)
   - anon public key   (a long string)

────────────────────────────────────────
## PART 2 — GitHub (storing the code)
────────────────────────────────────────
1. Go to https://github.com → sign in (parvezmohammed2024-bit).
2. Click "+" top right → "New repository". Name: nexify-crm → Create.
3. On the new repo page, click "uploading an existing file".
4. Drag in ALL the files from this folder (the whole project), then "Commit changes".
   (Tip: select everything inside the unzipped folder — you can drag the folders too.)

────────────────────────────────────────
## PART 3 — Vercel (publishing the website)
────────────────────────────────────────
1. Go to https://vercel.com → sign in with GitHub.
2. "Add New" → "Project" → import your nexify-crm repo.
3. Framework Preset should auto-detect "Vite". Leave defaults.
4. Expand "Environment Variables" and add these THREE:
   - VITE_SUPABASE_URL        = (your Supabase Project URL from Part 1, step 6)
   - VITE_SUPABASE_ANON_KEY   = (your Supabase anon public key)
   - ANTHROPIC_API_KEY        = (your key from https://console.anthropic.com)
                                 → this powers the AI buttons, safely on the server.
5. Click "Deploy". Wait ~1 minute. You'll get a live link like
   https://nexify-crm.vercel.app
6. Open it, log in with the email/password you created in Part 1, step 5. Done!

────────────────────────────────────────
## What you now have
────────────────────────────────────────
• Each team member logs in with their own email + password.
• Everyone shares the same leads & clients (live).
• The "History" tab shows who changed what and when.
• AI buttons (auto-tag, WhatsApp check, smart import) run with your key kept safe.

## Adding/removing team members later
Supabase → Authentication → Users → Add or delete users. That's it.

## A couple of honest notes
• If two people edit at the exact same second, the last save wins. For a small team
  this is rarely an issue, but good to know.
• Keep your Vercel link private to your team — anyone with a login can see the data.
• If an AI button ever says "not configured", it means ANTHROPIC_API_KEY is missing
  or mistyped in Vercel → re-check Part 3, step 4, then redeploy.
