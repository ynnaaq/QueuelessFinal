
create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  student_id text,
  course text,
  status text not null default 'Active'
    check (status in ('Active', 'Suspended')),
  created_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

-- Students can view their own profile.
create policy "Students view own profile"
on public.student_profiles
for select to authenticated
using (id = (select auth.uid()));

-- Administrators can view student accounts.
create policy "Admins view students"
on public.student_profiles
for select to authenticated
using (
  exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);

-- Only administrators can update student status.
create policy "Admins update students"
on public.student_profiles
for update to authenticated
using (
  exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);

-- Automatically create a student profile on signup.
create or replace function public.add_queueless_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'role' = 'student' then
    insert into public.student_profiles (
      id, email, full_name, student_id, course
    )
    values (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'student_id',
      new.raw_user_meta_data ->> 'course'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

create trigger queueless_student_signup
after insert on auth.users
for each row
execute function public.add_queueless_student();

-- Import existing student accounts.
insert into public.student_profiles (
  id, email, full_name, student_id, course
)
select
  u.id,
  u.email,
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'student_id',
  u.raw_user_meta_data ->> 'course'
from auth.users u
join public.user_roles r on r.user_id = u.id
where r.role = 'student'
on conflict (id) do nothing;
