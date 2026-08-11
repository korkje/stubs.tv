-- Invite-gated signups. The app is in production without payments, so open
-- registration stays off until billing exists: signing up requires an invite
-- from an existing user (admins mint unlimited invites, everyone else gets
-- app_settings.invite_allowance in total). The toggles live in app_settings,
-- editable from the Supabase dashboard, which doubles as the admin UI for
-- now. Enforcement is a trigger on auth.users, so it holds for every signup
-- path and works identically locally and hosted.

-- Single-row settings table: the primary key is pinned to true so a second
-- row cannot exist.
create table public.app_settings (
  single_row boolean primary key default true check (single_row),
  -- Flip to true to reopen public signup (when payments land).
  open_signups boolean not null default false,
  -- How many invites each non-admin user can create, in total.
  invite_allowance int not null default 3,
  updated_at timestamptz not null default now()
);

insert into public.app_settings default values;

alter table public.app_settings enable row level security;

-- Readable by everyone (the login page adapts to it); writable only from the
-- dashboard (postgres bypasses RLS — there are deliberately no write
-- policies or grants).
create policy "Anyone can read settings"
  on public.app_settings for select
  using (true);

grant select on public.app_settings to anon, authenticated;

create table public.invites (
  code uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz
);

create index invites_created_by_idx on public.invites (created_by);

alter table public.invites enable row level security;

create policy "Users can view own invites"
  on public.invites for select
  using ((select auth.uid()) = created_by);

grant select on public.invites to authenticated;

-- Creating an invite spends one of the allowance; a redeemed invite is still
-- spent. Admins have no cap. This is a security definer function rather than
-- an insert policy because a policy counting rows in its own table trips
-- Postgres's policy-recursion detection. Locking the caller's profile row
-- serializes concurrent calls, so the cap cannot be raced past.
create function public.create_invite()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code uuid;
  v_admin boolean;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  select is_admin into v_admin
    from public.profiles
   where user_id = v_uid
   for update;

  if not coalesce(v_admin, false)
     and (select count(*) from public.invites where created_by = v_uid)
         >= (select invite_allowance from public.app_settings) then
    raise exception 'No invites left.';
  end if;

  insert into public.invites (created_by) values (v_uid) returning code into v_code;
  return v_code;
end;
$$;

-- The enforcement itself. AFTER insert rather than BEFORE: redeemed_by
-- references the new user's row, which must exist first — raising here still
-- rolls back the whole signup, profile trigger included.
create function public.enforce_signup_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code uuid;
begin
  if (select open_signups from public.app_settings) then
    return new;
  end if;

  begin
    v_code := nullif(new.raw_user_meta_data ->> 'invite_code', '')::uuid;
  exception when invalid_text_representation then
    v_code := null;
  end;

  if v_code is null then
    raise exception 'Signups are invite-only right now.';
  end if;

  update public.invites
     set redeemed_by = new.id, redeemed_at = now()
   where code = v_code and redeemed_at is null;

  if not found then
    raise exception 'That invite is invalid or has already been used.';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created_enforce_signup
  after insert on auth.users
  for each row execute function public.enforce_signup_policy();

-- GoTrue flattens trigger exceptions into a generic "Database error saving
-- new user", so the signup form asks this first for a friendly message. The
-- trigger stays the enforcement; a race between check and signup is caught
-- there.
create function public.signup_gate(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_code uuid;
begin
  if (select open_signups from public.app_settings) then
    return 'open';
  end if;

  begin
    v_code := nullif(p_code, '')::uuid;
  exception when invalid_text_representation then
    return 'invalid';
  end;

  if v_code is null then
    return 'closed';
  end if;

  if exists (
    select 1 from public.invites where code = v_code and redeemed_at is null
  ) then
    return 'ok';
  end if;

  return 'invalid';
end;
$$;

-- PUBLIC holds EXECUTE on new functions by default, and anon/authenticated
-- inherit it — revoking from those roles alone would be a no-op. Revoking
-- from PUBLIC also removes it from service_role, hence the explicit grants.
revoke execute on function public.enforce_signup_policy from public;
revoke execute on function public.signup_gate from public;
grant execute on function public.signup_gate to anon, authenticated;
revoke execute on function public.create_invite from public;
grant execute on function public.create_invite to authenticated;
