# Homepage

`/` for signed-out visitors, and for anyone signed in without a band (members are sent on to their band). `src/components/Homepage.tsx`, styles under `.home` in `src/styles.css`.

- **Look:** a gig poster. Condensed headline (Archivo, bundled via `@fontsource-variable/archivo`, no external font host), three phones, a scrolling strip of features, then a gig in running order (weeks out → days out → the night before), show mode, how it's built, and a closing call to action.
- **Themes:** built on the app's tokens, so light and dark follow the theme like every other page. Signed out, the header has a light/dark toggle (the same `theme` cookie Settings uses).
- **Languages:** all text is in the dictionaries (`home` in `i18n.en.ts` / `i18n.nl.ts`). Signed out, the header has an EN/NL switch; it sets a `locale` cookie that `getMe` reads, then reloads. Not shown on the emailed availability page, which always speaks the recipient's language.
- **Screenshots:** `public/home/*.webp`, of the demo band (local mode, shown as "The Night Owls"), per theme (`phone-light-…` / `phone-dark-…`) and language (`…-nl`). Show mode is always dark. Retake them when the screens change.
- **No instance specifics:** the copy says "Gigg", not "gigg.band", so a self-hosted copy reads right. Buttons go to `/login` and the source on GitHub.
