# Admin and feedback

## Admin

`/admin`, for the instance admin: create bands (with a first member), delete them (soft delete, then permanent). Stats: bands, users, DB size, file size per band. Feedback overview.

## Feedback

Anyone in a band sends feedback from the account menu (`/<band>/feedback`); the admin page lists it and items can be marked done (hidden unless “Show all”). With `GITHUB_REPO` and `GITHUB_TOKEN` set, each one also becomes a GitHub issue (label `feedback`) holding only the text: no name, email or band, since issues on a public repo are public.

## Manual

A short static in-app manual at `/manual`, linked from the account menu. Its archive section links to the archived items of the current band (the last-opened one).
