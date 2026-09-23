-- Function EXECUTE goes only where it is meant to, on every database.
--
-- Earlier migrations revoked EXECUTE from PUBLIC and granted it back to the
-- roles that need it. That is enough on the local stack, whose default
-- privileges give new functions to nobody. Production's default privileges
-- also grant EXECUTE directly to anon and authenticated, and a revoke from
-- PUBLIC never touches a direct grant, so there every function, SECURITY
-- DEFINER ones included, was callable by anyone holding the publishable key.
-- Closed by hand on 2026-09-23; this records the same statements so every
-- environment matches.

-- Server only: the service role calls these (ingestion, the import worker,
-- the calendar feed). handle_new_user runs as a trigger, which needs no
-- EXECUTE grant.
revoke execute on function
  public.calendar_feed,
  public.handle_new_user,
  public.import_materialise_series,
  public.import_pending_series,
  public.rederive_providers,
  public.resolve_entities,
  public.resolve_entity,
  public.set_title_scores
from public, anon, authenticated;

-- Signed-in users only: each acts on auth.uid() or runs under the caller's
-- RLS, and none has anything to offer an anonymous caller.
revoke execute on function
  public.ensure_email_identity,
  public.export_user_data,
  public.mark_episodes_seen,
  public.unmark_episodes_seen,
  public.regenerate_calendar_token,
  public.remove_email_login,
  public.up_next
from public, anon;

-- Functions created from here on stop getting direct anon/authenticated
-- grants, matching the local stack. PUBLIC still gets EXECUTE through
-- Postgres's built-in default, which a per-schema revoke can't remove, so
-- every migration keeps revoking it and granting back only what it needs
-- (AGENTS.md, Database gotchas).
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
