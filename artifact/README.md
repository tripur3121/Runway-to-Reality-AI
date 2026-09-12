# The Shared Rack (Claude Artifact build)

`the-shared-rack.html` is a self-contained, single-file rebuild of Runway to Reality AI as a [Claude Artifact](https://claude.ai/code/artifact/bebf284b-747a-4c57-880e-e1a8d11fc079) — a hosted page with its own shareable link, for when you want a live preview without running a server.

It has no build step and no npm dependencies (same constraint as the main app — see the root `README.md`). Instead of the Node backend in `server/`, it uses three Claude Artifact runtime capabilities in the browser:

- **`db`** — the shared closet inventory, claims, laundry status, and the latest Lookbook/Squad Sync/Roulette results, synced live to every viewer.
- **`room`** — WebRTC signaling and presence for the Fitting Room call, plus live vote/emoji-burst broadcasting.
- **`sample`** — asks the viewer's own Claude for the Nudge Agent's texts, Lookbook styling tips, and Squad Sync notes, with the same template fallback the Node build uses when no AI is available.

Everything degrades gracefully without those capabilities (e.g. opened outside claude.ai): it falls back to an in-memory demo dataset and template-generated text, so the page is never broken, just less "live."

To update the published artifact, republish this file's contents to the URL above from a Claude Code session.
