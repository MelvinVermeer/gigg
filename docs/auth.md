# Auth & access

- Login: **passkeys + email magic link**. No passwords. After an email-link sign-in a passkey is offered.
- Roles per band:
  - `reader`: read only
  - `member`: everything, including inviting members/readers
- Instance admin: env var with admin emails (no role in DB). Self-hosters set their own. Locally `admin@example.com` is the admin.
- **Creating a band is admin only.** The admin creates the band and adds its first member (who gets an invite mail).
- A logged-in user still sees the public site; the user menu leads to `/<band>`. After login → straight to `/<band>`.
- `/` opens your current band: the last-opened one on this device (a `band` cookie, set by every `/<band>` page) if you're still a member, else your first band. No band, or signed out → the tagline page (header has "Sign in"). The redirect runs client-side, so `/` stays cached for an offline app launch.
- No public band page. Only explicitly shared links are public.

URLs:

```
gigg.band/one-after-909/events/agnietenhof
gigg.band/one-after-909/songs/a-day-in-a-life
```

Old slugs redirect after a rename.
