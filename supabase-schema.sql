-- ============================================================
-- Nexify CRM — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → Run
-- ============================================================

-- 1. The single shared CRM data row (leads + clients as JSON)
create table if not exists crm_data (
  id int primary key default 1,
  data jsonb not null default '{"leads":[],"clients":[]}',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into crm_data (id, data)
values (1, '{"leads":[],"clients":[]}')
on conflict (id) do nothing;

-- 2. Audit log — records who changed what
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  user_email text,
  action text not null,
  created_at timestamptz default now()
);

-- 3. Turn on Row Level Security
alter table crm_data enable row level security;
alter table audit_log enable row level security;

-- 4. Policies: any logged-in team member can read & write
create policy "team read data"  on crm_data for select to authenticated using (true);
create policy "team write data" on crm_data for update to authenticated using (true) with check (true);
create policy "team insert data" on crm_data for insert to authenticated with check (true);

create policy "team read audit"  on audit_log for select to authenticated using (true);
create policy "team write audit" on audit_log for insert to authenticated with check (true);

-- Done. Now create team logins under Authentication → Users → Add user.
