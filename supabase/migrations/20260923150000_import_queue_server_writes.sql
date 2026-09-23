-- The TV Time import queue is written by the server only (ADR-0022).
--
-- commitImport enforces the plan, the size caps and payload validation
-- before it persists anything, and the worker trusts the queue to hold
-- exactly that. Until now authenticated users also held full DML on these
-- tables under owner-only policies, so nothing stopped the same rows from
-- being written, reset or re-dated directly through the API instead. Users
-- keep read access (progress bar, reconciliation report, GDPR export);
-- commitImport and the manual film pick write through the service role
-- after requireWriteAccess(), as the worker already does.

-- An intent's job must belong to the intent's own user. A foreign key on
-- job_id alone can't say that, and foreign-key checks ignore RLS, so the
-- reference becomes (job_id, user_id). Rows that break the rule can only
-- have been written directly through the API: drop them first.
alter table public.import_jobs
  add constraint import_jobs_id_user_id_key unique (id, user_id);

delete from public.import_watch_intents i
using public.import_jobs j
where j.id = i.job_id and j.user_id <> i.user_id;

delete from public.import_movie_intents i
using public.import_jobs j
where j.id = i.job_id and j.user_id <> i.user_id;

alter table public.import_watch_intents
  drop constraint import_watch_intents_job_id_fkey,
  add constraint import_watch_intents_job_id_user_id_fkey
    foreign key (job_id, user_id)
    references public.import_jobs (id, user_id) on delete cascade;

alter table public.import_movie_intents
  drop constraint import_movie_intents_job_id_fkey,
  add constraint import_movie_intents_job_id_user_id_fkey
    foreign key (job_id, user_id)
    references public.import_jobs (id, user_id) on delete cascade;

-- Read-only for their owners. service_role keeps the grants it was given
-- in 20260819000000_import_jobs.sql.
do $$
declare t text;
begin
  foreach t in array array['import_jobs', 'import_watch_intents', 'import_movie_intents']
  loop
    execute format('drop policy "Users manage their own rows" on public.%I', t);
    execute format(
      'create policy "Users read their own rows" on public.%I for select '
      'using ((select auth.uid()) = user_id)', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
  end loop;
end;
$$;

revoke usage, select on sequence public.import_jobs_id_seq from authenticated;
revoke usage, select on sequence public.import_watch_intents_id_seq from authenticated;
revoke usage, select on sequence public.import_movie_intents_id_seq from authenticated;
