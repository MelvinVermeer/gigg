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
- Clonable.
- Total duration per set / setlist.
- **Show mode** (single person): one whole set per screen in big type, swipe to the next set, screen stays on, per-song notes visible, works offline. Also for standalone setlists.
- **Stage-floor PDF export**: one page per set, via the print stylesheet. Blocks are not shown as headings, only their songs. Also for standalone setlists.
