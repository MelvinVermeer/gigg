# Songs (repertoire)

Fixed fields: title, duration, key, BPM, tuning/instrument changes, notes (markdown), lyrics (markdown), tags.

**Lyrics**: markdown like notes, line breaks kept as typed. Only on the song page (after notes, under a “Lyrics” heading, left out when empty) and in the song form; not in the songs list, search or the shown-fields grid. They do travel with setlists, for the lyrics show mode (see [setlists.md](setlists.md)).

**Custom fields** (Settings → Songs): single-line text fields the band adds to every song ("Lead vocal", "Capo"). Members add, rename (on blur / Enter) and archive/restore them; readers see the list. Names: up to 40 characters, unique per band ignoring case (archived ones included), not a fixed field's name in any language; shown as typed, not translated. No reordering: creation order. Values: optional, up to 100 characters, one line; in the song form after the fixed fields (before notes), on the song page like the fixed fields ("–" when empty). Archiving a field hides it everywhere but keeps its values (the form doesn't send archived fields, the server keeps their values). Not in the songs list or search. Files attached (lyrics, recordings, sheets); see [files.md](files.md).
