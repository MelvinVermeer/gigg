-- Tags are lowercase from now on (see `tags` in ops.ts): lowercase existing ones, merging
-- duplicates that only differed in case, keeping the first one's position.
create function lowercase_tags(t text[]) returns text[] language sql immutable as $$
  select coalesce(array_agg(tag order by pos), '{}')
  from (select lower(x) as tag, min(n) as pos from unnest(t) with ordinality u(x, n) group by lower(x)) d
$$;
--> statement-breakpoint
update events set tags = lowercase_tags(tags) where tags is distinct from lowercase_tags(tags);
--> statement-breakpoint
update songs set tags = lowercase_tags(tags) where tags is distinct from lowercase_tags(tags);
--> statement-breakpoint
drop function lowercase_tags(text[]);
