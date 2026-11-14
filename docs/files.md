# Files

Common PDFs, recordings, lyrics, song notes, riders. Attachable to songs and events (several each; listed on their pages, members upload by button or by dropping files on the card; remove is a red bin icon).

Bytes live in Vercel Blob (private; a local folder in dev), served through `/api/files/<id>` to band members only. Up to 100 MB each: in production the browser uploads straight to Blob (token from `/api/files/upload`, multipart above 8 MB) and downloads via a 5-minute signed URL, so big files never pass through a function. The admin page shows total file size per band.
