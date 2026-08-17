-- Open public signups (ADR-0014). The invite gate existed to keep signups
-- closed until billing existed; payments are live (ADR-0013), so the whole
-- apparatus goes: the enforcement trigger, its helper functions, the invites
-- ledger, and app_settings (whose only two columns were invite-system
-- state — nothing else read it).
--
-- Order matters: the trigger depends on its function, and the functions read
-- the tables, so drop top-down.

drop trigger on_auth_user_created_enforce_signup on auth.users;
drop function public.enforce_signup_policy();
drop function public.signup_gate(text);
drop function public.create_invite();
drop table public.invites;
drop table public.app_settings;

-- Public signups start read-only: 'free' until a Polar checkout completes
-- and the webhook grants 'paid' (see 20260817000000_billing.sql). Existing
-- rows stay 'comp' (friends & family, full access). The seed still grants
-- the local dev account 'comp' explicitly so `db reset` keeps a writable
-- login.
alter table public.profiles alter column plan set default 'free';
