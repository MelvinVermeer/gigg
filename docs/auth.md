# Auth & access

- Login: **passkeys + email magic link**. No passwords. After an email-link sign-in a passkey is offered.
- Roles per band:
  - `reader`: read only
  - `member`: everything, including inviting members/readers
- Instance admin: env var with admin emails (no role in DB). Self-hosters set their own. Locally `admin@example.com` is the admin.
- **Creating a band:** the admin creates the band and adds its first member (who gets an invite mail). With `OPEN_SIGNUP` on, anyone can too, at `/signup`:
  - Email + band name, nothing else. The mail is a normal magic link whose callback (`/api/signup`) carries the band name, signed with the auth secret over email + name + time, so only that link can create the band (no CSRF, no bands under someone else's email). Opening it again returns the same band. It lands on the band's "Get to know gigg" page ([welcome.md](welcome.md)), with the passkey offer.
  - New users get an empty name and their browser's language. An existing account gets the band added. The form responds the same either way.
  - Sign-up off: no "Start a band" links (tagline page, sign-in page) and `/signup` is a 404.
  - `/privacy` explains what's stored. Deletion is requested through the feedback form.
- A logged-in user still sees the public site; the user menu leads to `/<band>`. After login → straight to `/<band>`.
- `/` opens your current band: the last-opened one on this device (a `band` cookie, set by every `/<band>` page) if you're still a member, else your first band. No band, or signed out → the tagline page (header has "Sign in"). The redirect runs client-side, so `/` stays cached for an offline app launch.
- No public band page. Only explicitly shared links are public.

URLs:

```
gigg.band/the-night-owls/events/wedding-at-hotel-meridian
gigg.band/the-night-owls/songs/come-together
```

Old slugs redirect after a rename.
