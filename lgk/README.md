# InfoSiteMRSM

MRSM Langkawi information display and admin page.

## Backend feed template

The display and admin page use `https://gapim.onrender.com/infositemrsm`.
The reusable feed shape is in `../template/backend/feed.example.json`. The
backend must support:

- `GET /infositemrsm` returning the complete saved feed as JSON.
- `PUT /infositemrsm` saving the submitted feed and making it visible to later
  GET requests. The admin also tries POST if PUT is not accepted.
- CORS for the website's origin, including JSON `PUT`/`POST` requests.

Keep the whole document when saving, including `slides`, `events`, and `settings`.
Each slide can contain `title`, `message`, `imageUrl`, `videoUrl`, `caption`,
and `template`. Use `caption: "maktab"` or `"bwp"` for a picture announcement;
submitting an updated announcement replaces the existing item for that
section. `settings.timetableUrl` is the public HTTPS embed URL. The ticker is
available as `settings.footerNews` (also mirrored to `settings.slidingText`,
top-level `slidingText`, and `newsText` for compatibility).

Each event has an `id`, `title`, `startsAt` ISO timestamp (with the
`+08:00` Kuala Lumpur offset), and optional `pinnedImageUrl`. Add and manage
events in `admin.html`. The display beeps once per second during the final 10
seconds, then opens `misc/solat.html` for one minute at the event time and
returns to `index.html`. Browser audio must be enabled once on each display.

Displays check the shared feed every 10 seconds, so updates appear without
manually refreshing. This depends on the backend persisting writes and
returning the latest feed from GET; this repository contains the client and
payload template, not the hosted API's server or database implementation.

Serve the display over HTTP(S), not by opening `index.html` as a local file:
YouTube requires an HTTP referrer to play embedded videos. The display tries
to autoplay videos with sound; browsers that block audible autoplay fall back
to muted playback, and **Enable audio** can be used to turn sound on.

## Display details

- Prayer times use the KDH06 monthly feed from
  `https://api.waktusolat.online/api/solat/KDH06`, matched to the current
  `Asia/Kuala_Lumpur` date and month.
- Dates use the Malaysian locale and Kuala Lumpur timezone; the Hijri date
  comes from the same prayer-time feed.
- Configure a public HTTPS timetable embed in `admin.html` (Display control).
  Some sites disallow iframe embedding, even when their page is public. Keep
  the embed URL set to its one-day view; the display reserves a taller panel
  for it.
- The standalone maintenance display is `misc/maintainance.html`.
