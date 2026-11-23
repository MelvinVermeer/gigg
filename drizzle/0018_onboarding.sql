ALTER TABLE "memberships" ADD COLUMN "onboarding_hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_seen" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- "Get to know gigg" state is personal view state, not band data: an update that only changes it
-- (and users.updated_at, which the app bumps on every write) is not logged.
create or replace function audit() returns trigger language plpgsql as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  r jsonb := coalesce(new_row, old_row);
begin
  if tg_op = 'UPDATE' and old_row - array['onboarding_hidden_at', 'onboarding_seen', 'updated_at']
                        = new_row - array['onboarding_hidden_at', 'onboarding_seen', 'updated_at'] then
    return null;
  end if;
  insert into changes (band_id, user_id, table_name, row_id, action, before, after)
  values (
    (case when tg_table_name = 'bands' then r->>'id' else r->>'band_id' end)::uuid,
    nullif(current_setting('app.user_id', true), '')::uuid,
    tg_table_name,
    r->>'id',
    lower(tg_op),
    old_row,
    new_row
  );
  return null;
end $$;
