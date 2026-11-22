# Setlists

```
Setlist
└── Set (Set 1, Set 2 after break, …)
    ├── Song
    ├── Block (Acoustic bit, Encore, …)
    │   └── Song, Song, …
    └── Song
```

- **Blocks are reusable templates**: define "Acoustic bit" or "Encore" once. Adding a block to a set *copies* its songs into the setlist, with no live reference, so later edits to the block never change existing setlists (including played events).
- Linked to an event (one setlist per event), at `/<band>/events/<event>/setlist`.
- **Standalone setlists** (no event: "Standard 2 sets", "Short club set") at `/<band>/setlists`. A new event can start from a copy of one (picked in the event form); copies, never live links, like blocks.
- Setlists open in display mode with an Edit button.
- Builder: every change saves immediately; songs move by drag and drop, within a set or between sets (long-press on touch with a small haptic tick on Android (iOS can't), a grip handle with a mouse; a yellow line shows where it lands); dragged out of the setlist (above/below the sets, or to the screen's side edge) removes it. Blocks reorder the same way. ↑ ↓ stay for the keyboard, visible on focus. A new setlist starts empty or as a copy of another setlist (standalone or an event's).
- Blocks are managed on the Setlists page (`/<band>/setlists`).
- **Duplicates**: a song that's in the setlist more than once (any set, added alone or via a block) gets a small amber “⚠️ Duplicate” after its title on every copy, on the setlist page (display and edit). A warning only: nothing blocks it, no dismiss; show mode, print, lyrics and Excel don't show it.
- Clonable.
- Total duration per set / setlist.
- **Download menu** (right of the song count, not while editing): Excel, Print, Show mode, Show mode (lyrics).
- **Shown fields** (Settings → Setlists, per person per band): a grid of song fields × outputs (page, show mode, print, Excel). Title always; # (the 1. 2. in front, off removes the numbering), key, BPM, tuning, duration, the custom fields and notes can be ticked; tags not. Defaults (until you tick anything): # everywhere, plus page key + duration, show mode key + notes, print key, Excel key, BPM, tuning, duration. New custom fields start unticked for everyone. One order everywhere: key, BPM, tuning, duration, custom fields (creation order), notes. Page, show mode and print: small muted text after the title joined by " · " (BPM as "120 BPM", other values without labels), notes on their own line as plain text; duration keeps its right-hand column on the page. Blocks always show key + duration.
- **Excel**: a CSV built in the browser (works offline): `# ; Title ;` then your ticked fields with their names as headers, numbered per set, a blank row between sets, semicolons, UTF-8 with BOM. Named after the setlist (or event). A real .xlsx is still on the list.
- **Show mode** (single person): one whole set per screen in big type, swipe to the next set, screen stays on, per-song notes visible, works offline. Also for standalone setlists.
- **Show mode (lyrics)** (`…/lyrics`): one song per screen, swiping straight across sets. Each screen: “Set 1 · 3/12”, the title, the small inline fields ticked for show mode, then the lyrics in large type (scroll down for long ones); a song without lyrics shows just its title. Otherwise like show mode: ‹ › and arrow / page keys, screen stays on, works offline.
- **Stage-floor PDF export**: Print in the Download menu opens the browser's print dialog straight away (no separate page): hidden stage sheets on the setlist page, one page per set, via the print stylesheet; Ctrl/Cmd+P on the setlist page prints the same. Blocks are not shown as headings, only their songs. The font shrinks to fit the extra text and note lines too. Also for standalone setlists.
