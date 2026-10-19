-- Run this in Supabase SQL Editor before deploying the promotion feature.
create table if not exists public.promotion_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  office text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists promotion_notifications_user_unread
  on public.promotion_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.promotion_notifications enable row level security;

create policy "Users read their own promotion notifications"
on public.promotion_notifications
for select to authenticated
using (user_id = (select auth.uid()));

-- No client-side insert/update policy is intentionally provided. The API uses
-- SUPABASE_SERVICE_ROLE_KEY to create and mark promotion notices securely.
