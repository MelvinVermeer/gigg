-- Audit trail: every insert/update/delete on audited tables is logged in `changes`.
-- The app sets the acting user per transaction: select set_config('app.user_id', <uuid>, true).
-- New tables must be added to the list below; a Vitest test fails if one is missing.
create function audit() returns trigger language plpgsql as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  r jsonb := coalesce(new_row, old_row);
begin
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
--> statement-breakpoint
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'bands', 'memberships', 'slug_redirects', 'songs', 'venues', 'contacts',
    'gigs', 'gig_contacts', 'setlists', 'sets', 'set_items', 'blocks', 'block_songs',
    'files', 'feedback'
  ] loop
    execute format('create trigger audit after insert or update or delete on %I for each row execute function audit()', t);
  end loop;
end $$;
