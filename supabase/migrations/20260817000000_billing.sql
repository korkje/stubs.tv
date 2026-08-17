-- Billing state for Polar payments (ADR-0013).
--
-- The plan enum drops the never-assigned basic/pro split (VISION.md's old
-- two-tier pricing, superseded by a single paid tier sold monthly, annually
-- or as a lifetime pass) in favor of:
--
--   comp  - friends & family, full features, free forever; the default while
--           signups are invite-only, and never touched by billing sync
--   free  - restricted tier: what a lapsed subscriber drops to, and the
--           public free tier if signups ever open up
--   paid  - active subscription or lifetime pass, granted only by Polar
--           webhook events
--
-- All existing rows are 'comp' (basic/pro were unreachable — no checkout
-- existed), but map them to 'paid' anyway rather than lose a grant if one
-- was ever set by hand.

alter type public.plan rename to plan_old;
create type public.plan as enum ('comp', 'free', 'paid');

alter table public.profiles
  alter column plan drop default,
  alter column plan type public.plan
    using (case plan::text when 'comp' then 'comp' else 'paid' end::public.plan),
  alter column plan set default 'comp';

drop type public.plan_old;

-- One row per user who has ever checked out in Polar; comp users have none.
-- The webhook handler (the only writer) recomputes profiles.plan from this
-- row: lifetime or an active subscription means 'paid', anything else means
-- 'free'. Kept separate from profiles because a lapsed subscription must not
-- erase the fact that someone holds a lifetime pass.
create table public.billing (
  user_id uuid primary key references auth.users (id) on delete cascade,
  polar_customer_id text not null unique,
  lifetime boolean not null default false,
  -- Latest Polar subscription status ('active', 'trialing'), null when no
  -- active subscription. Display data, not an access check — plan is.
  subscription_status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.billing enable row level security;

create policy "Users can view own billing"
  on public.billing for select
  using ((select auth.uid()) = user_id);

-- Grants are never implicit in this project (see AGENTS.md): the select
-- policy needs a matching grant, and the service role used by the webhook
-- handler can write nothing without one, despite bypassing RLS.
grant select on public.billing to authenticated;
grant select, insert, update on public.billing to service_role;
