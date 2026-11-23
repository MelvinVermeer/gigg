# Files

Common PDFs, recordings, lyrics, song notes, riders. Attachable to songs and events (several each; listed on their pages, members upload by button or by dropping files on the card; remove is a red bin icon).

Bytes live in Vercel Blob (private; a local folder in dev), served through `/api/files/<id>` to band members only. Up to 100 MB each: in production the browser uploads straight to Blob (token from `/api/files/upload`, multipart above 8 MB) and downloads via a 5-minute signed URL, so big files never pass through a function. The admin page shows total file size per band.

**Storage limit:** `BAND_STORAGE_LIMIT_MB` caps what each band stores, archived files included (they still occupy Blob). Unset means no limit. The upload token is refused when the file doesn't fit (and Blob is told the bytes left), the file list refuses before uploading ("This band's storage is full"), and recording the file checks again. Band settings shows "Storage: 340 MB of 1 GB" to members when a limit is set.
