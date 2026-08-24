-- OAuth signups carry their name in full_name (Google, and Apple's
-- first-authorization payload) or name — never display_name, which only our
-- own signup path sets. Without this, every "Sign in with …" account starts
-- with a null display name despite the provider having told us one.
-- CREATE OR REPLACE keeps the function's grants/ownership but not omitted
-- clauses, so security definer + search_path are restated.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  );
  return new;
end;
$$;
