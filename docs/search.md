# Search

`/<band>/search`, the search box is always in the header; clearing it goes back. Results update as you type.

- Songs (title), events (title and venue name), venues (name, address), contacts (name, organisation, email)
- Files by name; a result opens the file, with the song or event it belongs to.
- Substring matches plus typo tolerance (Postgres `pg_trgm` `word_similarity`), best first; no separate search service
- Venue/contact results open their row on the settings page
- Archived items are left out.
