-- The profiles migration created a "Users can view own profile" select policy
-- but never granted SELECT, and Supabase's default privileges do not include
-- it — so the policy had no effect and the app could not read profiles at all.
-- (Not yet noticed because nothing has read the table so far.)
grant select on public.profiles to authenticated;

-- Likewise the service role, which needs explicit privileges even though it
-- bypasses RLS (for admin surfaces and account deletion later).
grant select, insert, update, delete on public.profiles to service_role;

-- Trigger functions cannot usefully be called directly, but PUBLIC holds
-- EXECUTE on them by default; this one is SECURITY DEFINER, so drop it.
revoke execute on function public.handle_new_user from public;
