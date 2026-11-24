# College information display

This repository contains the current Langkawi deployment and a reusable client template.

## Folders

- [`lgk/`](lgk/) — current active MRSM Langkawi version. Serve `lgk/index.html` over HTTP(S); its admin page is `lgk/admin.html`.
- [`template/frontend/`](template/frontend/) — generic frontend starter. Customize `config.js`, page labels, and styles for each client.
- [`template/backend/`](template/backend/) — framework-independent API contract and empty example feed. It is not a backend implementation.

## Starting a client version

1. Copy `template/frontend/` and `template/backend/` into a new version folder.
2. Set `collegeName`, `timeZone`, `locale`, backend origin, and prayer feed in the frontend `config.js`.
3. Implement the feed API described in `template/backend/README.md`, or adapt the frontend to the client's existing backend.
4. Configure the prayer provider to return the documented daily schedule shape, or adapt the frontend parser.
5. Serve the frontend over HTTP(S), then test both the display and admin page against that client's backend.

The repository root `LICENSE` applies to the project.
