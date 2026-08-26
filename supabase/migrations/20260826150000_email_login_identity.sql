-- Email/password as a first-class, symmetric sign-in method (ADR-0020).
--
-- GoTrue only creates an 'email' identity row at email signup. A password
-- set later — updateUser() during the recovery flow — lands in
-- auth.users.encrypted_password with no identity row, so identity-based
-- UI ("which sign-in methods do I have?") never learns about it; and
-- unlinking the email identity deletes the row but leaves the password
-- working (both verified against GoTrue v2.188.1 local / v2.195.0 prod).
-- These two functions own that gap: one materializes the identity a set
-- password implies, the other removes both halves together so
-- "Disconnect" actually revokes password sign-in.
--
-- Both write auth.* directly, which rests on the postgres role's DML
-- grants on auth.users/auth.identities and on GoTrue's row shapes —
-- re-verify on GoTrue upgrades (ADR-0020 records the shapes proven).
-- GoTrue v2.196.0 fixed the insert half upstream
-- (ensureEmailIdentityForPassword) behind an experimental flag that
-- hosted Supabase has not enabled and that backfills nothing; these
-- functions are the bridge until it ships for real (ADR-0020).

-- app_metadata.providers is itself derived from identities (GoTrue and
-- the dashboard both read it), so every identity write here re-derives
-- it the way upstream does. Internal helper: executable only by the two
-- definer functions below (they run as the owner), never granted out —
-- it takes an arbitrary user id.
create function public.rederive_providers(p_user_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('providers', coalesce((
         select jsonb_agg(provider order by created_at)
         from auth.identities
         where user_id = p_user_id
       ), '[]'::jsonb))
  where id = p_user_id;
$$;

-- Inserts the 'email' identity for the calling user iff they hold a real
-- password, a confirmed email (upstream's guard), and the row is missing.
-- Idempotent (unique (provider_id, provider)); called after any password
-- is proven — recovery completes, or a password sign-in succeeds — so
-- pre-fix accounts heal themselves. email_verified is true by
-- construction: a password only ever arrives through the recovery link
-- (mailbox proven) or email signup confirmation.
create function public.ensure_email_identity()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
begin
  select * into v_user from auth.users where id = (select auth.uid());
  if v_user.id is null then
    raise exception 'ensure_email_identity: not signed in';
  end if;

  -- No usable password, nothing to represent: OAuth-created users carry
  -- null or '', and the password grant rejects both.
  if v_user.encrypted_password is null or v_user.encrypted_password = '' then
    return;
  end if;

  if v_user.email_confirmed_at is null then
    return;
  end if;

  insert into auth.identities
    (provider_id, user_id, identity_data, provider,
     last_sign_in_at, created_at, updated_at)
  values (
    v_user.id::text,
    v_user.id,
    jsonb_build_object(
      'sub', v_user.id::text,
      'email', v_user.email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  if found then
    perform public.rederive_providers(v_user.id);
  end if;
end;
$$;

-- Removes email/password sign-in for the calling user: the identity row
-- AND the password, together — GoTrue's own unlink leaves the password
-- live, which would make "Disconnect" theater. Refuses when no other
-- identity remains (mirrors GoTrue's last-identity rule). Keying the
-- guard on "another identity exists" (not "email identity exists") also
-- covers pre-fix accounts that hold a password without the row. The
-- account email itself is untouched: it stays the anchor for recovery,
-- which is what lets email/password be re-added later.
create function public.remove_email_login()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'remove_email_login: not signed in';
  end if;

  if not exists (
    select 1 from auth.identities
    where user_id = v_uid and provider <> 'email'
  ) then
    raise exception 'remove_email_login: last sign-in method';
  end if;

  delete from auth.identities
  where user_id = v_uid and provider = 'email';

  update auth.users
  set encrypted_password = null, updated_at = now()
  where id = v_uid;

  perform public.rederive_providers(v_uid);
end;
$$;

-- PUBLIC holds EXECUTE on new functions and every role inherits it, so
-- revoke from PUBLIC itself, then grant back exactly who needs what.
-- Only signed-in users: both functions are auth.uid()-scoped and have no
-- service-role caller.
revoke execute on function public.ensure_email_identity from public;
grant execute on function public.ensure_email_identity to authenticated;

revoke execute on function public.remove_email_login from public;
grant execute on function public.remove_email_login to authenticated;

-- Deliberately granted to no one: only the two definer functions above
-- reach it, running as its owner.
revoke execute on function public.rederive_providers from public;
