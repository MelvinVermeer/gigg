-- The play button is a shown field ('play', page only) and on by default; people who already saved
-- their shown fields get it too.
update shown_fields
set fields = jsonb_set(fields, '{page}', (fields -> 'page') || '["play"]')
where jsonb_typeof(fields -> 'page') = 'array' and not (fields -> 'page') ? 'play';
