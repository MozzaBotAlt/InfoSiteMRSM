# InfoSiteMRSM
MozzaBot Project ID:

TV Display Information

## Backend feed

The display reads JSON from `GET https://gapim.onrender.com/infositemrsm`. Use
`backend-feed.sample.json` as the blank payload shape. A feed can be a
`slides` object or a bare array of slides. Each slide should contain one image
or one video URL; image slides advance after five seconds, while video slides
advance when playback ends.

The client also accepts the sample field names `picture`, `youtube`, and
`sliding text` as aliases for `imageUrl`, `videoUrl`, and `message`. The
`template` field selects one of the ten text-overlay positions listed in
`announcement-templates.json`.

The admin client sends `slides`, `announcements`, and `settings` to the same
endpoint with `PUT`. Enable cross-origin requests for the site hosting this
display. The display has no local content fallback; an empty or unavailable
feed remains a blank screen.
