-- Profiles: one row per auth user, created automatically on signup.
-- See docs/DATA-MODEL.md.

create type public.plan as enum ('comp', 'basic', 'pro');

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  plan public.plan not null default 'comp',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- plan and is_admin must only be changed by the service role; revoke the
-- columns from the update grant for authenticated users.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
