-- Local development seed. Runs after migrations on `npx supabase db reset`
-- (wired up by [db.seed] in config.toml). Never run this against a hosted
-- project — `supabase db reset --linked` would seed it too.
--
-- Its only job is to make a fresh local stack signable-in. Signups are
-- invite-only (see 20260811080000_signup_policy.sql), and an invite needs a
-- creator, so an empty database has no way in: no user means no invite, and
-- no invite means no user. The seed breaks that circle by minting the first
-- account directly.
--
--     dev@stubs.local / password
--
-- The account is an admin, which lifts the invite allowance — so further test
-- accounts can go through the real signup form and redeem a real code from
-- /app/invites, exercising the path users actually take.

do $$
declare
  -- Fixed so the seeded rows are the same after every reset: anything
  -- referencing this user (a saved session, a bookmarked URL) survives.
  v_user_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_email constant text := 'dev@stubs.local';
begin
  -- Applying the seed by hand against a database that already has it should
  -- be a no-op rather than a unique-violation.
  if exists (select 1 from auth.users where id = v_user_id) then
    return;
  end if;

  -- enforce_signup_policy() is an AFTER INSERT trigger on auth.users, so it
  -- guards every path into the table — this insert and the dashboard's "Add
  -- user" alike, not just the signup form. Opening signups for the length of
  -- the insert is narrower than disabling the trigger: the policy still runs,
  -- it just takes its open-signups branch.
  update public.app_settings set open_signups = true;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    -- display_name is what handle_new_user() copies into the profile.
    raw_user_meta_data,
    -- These are nullable in the table but GoTrue reads them into plain
    -- strings, so a NULL makes every sign-in fail with a 500 and the
    -- thoroughly misleading "Database error querying schema". The signup
    -- endpoint writes empty strings; do the same.
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt('password', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"display_name": "Dev"}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

  -- A password login resolves the account through auth.identities, not
  -- auth.users: without this row the sign-in fails with invalid credentials
  -- even though the hash above matches.
  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  -- Back to the production default, so the local stack keeps enforcing the
  -- same gate the real one does.
  update public.app_settings set open_signups = false;

  -- The profile row already exists — handle_new_user() made it on the insert
  -- above. Admin is what removes the invite cap.
  update public.profiles set is_admin = true where user_id = v_user_id;
end $$;
