# Runway to Reality AI

A shared closet app for Maya, Liam & Sophie — built for someone who's into fashion but too low-effort to plan an outfit the night before. A squad of small, single-purpose AI agents plans it for you.

## Why this exists

Picking an outfit is a daily tax nobody wants to pay. This app lets an agent plan tomorrow's fit tonight, keeps three roommates' closets honest about who has what, and turns "what should we all wear Saturday" into one tap instead of a group chat.

## Quick start

```bash
npm start
# open http://localhost:8787
```

No `npm install` required — see **Why zero dependencies** below.

Optional environment variables (create a `.env`-style export before `npm start`, or set in your shell):

- `GEMINI_API_KEY` — when set, the Nudge, Lookbook, and Squad Sync agents call Gemini (`gemini-2.0-flash`) live for text generation, and the Lookbook's "Generate real video (Veo)" button becomes usable (see below). Without it, every agent falls back to a curated template bank, so the app is fully functional offline/out of the box. Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — Veo video generation specifically needs a key with Veo access/billing enabled, which is separate from basic Gemini text access.
- `VEO_MODEL` — optional, defaults to `veo-2.0-generate-001`. Override if Google renames/versions the model.
- `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_BUSINESS_ID` — when both are set, Influencer Inspo pulls real posts via Instagram's [Business Discovery API](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/business-discovery-api) instead of mock data. `INSTAGRAM_BUSINESS_ID` is the id of *your own* linked Instagram Business/Creator account (from a Meta developer app); `INSTAGRAM_ACCESS_TOKEN` is a long-lived token for that account with `instagram_business_basic`. The handle you look up must also be a public Business/Creator account — personal accounts aren't discoverable this way.
- `PORT` — defaults to `8787`.

## Feature tour

1. **Shared Closet with Detailed Specs** — filter by Maya's / Liam's / Sophie's / All Group Pool. Every piece carries Size, Fabric, and Brand. One tap flips Laundry Status between Fresh and In Hamper. Maya's Camel Trench Coat is pre-claimed by Liam on load, exactly to demonstrate #2 below.
2. **Real-Time Borrowing & Visual Grey-Out** — claiming a pool item greys out its photo and stamps a bold `TAKEN BY [NAME]` banner across it, live for every open tab (via Server-Sent Events). "Nudge" asks the Nudge Agent to draft a witty, non-passive-aggressive return-reminder text.
3. **"Same Fit, Different Member" AI Video Lookbook** — "Curate My Outfit" pulls a complementary set from the pool. "Watch AI Video Runway" plays an animated motion-runway simulation (CSS/SVG) that rescales per member height (Maya 5'5" S, Liam 6'1" L, Sophie 5'8" M) with tailored micro-styling tips per perspective, plus an exportable cinematic 4K prompt — and a "Generate real video (Veo)" button that actually renders it with Google's Veo model when `GEMINI_API_KEY` has video access (see below).
4. **Live WebRTC Video & Audio Fitting Room** — the top-right "Fitting Room Call" button opens a native, browser-only peer-to-peer video call (no external call service). Open a second tab and join to connect both feeds. Fit Check reactions (🔥 Fire / 💅 Slay / 👟 Swap Shoes / 🙅 Hard Pass) burst floating emoji across every connected tab and move a shared live approval gauge.
5. **Squad Sync & Closet Swap Roulette** — name an event and the Squad Sync Agent assigns Maya, Liam & Sophie complementary color roles from one palette. Swap Roulette spins one fusion "dare" piece per sibling from someone else's closet.
6. **Multi-agent architecture** — see **AI Agents** in the app, or `server/agents/`. Each agent owns exactly one job: `nudgeAgent`, `lookbookAgent`, `squadSyncAgent`, `rouletteAgent`, `votingAgent`, `influencerAgent`. `orchestrator.js` is the roster/registry every route reads from.
7. **Influencer Inspo** — add a favorite stylist's handle and the Influencer Inspo Agent returns only their posts from the last 3 months, with style tags to pull ideas from. See below for how to make this live.

## Architecture

```
server/
  server.js          zero-dependency HTTP server: static files, REST routes, SSE broadcast hub, WebRTC signaling relay
  data/store.js       in-memory seed data (members, closet items, votes, influencer list)
  agents/
    geminiClient.js    shared Gemini REST caller, returns null on missing key/failure so callers degrade gracefully
    nudgeAgent.js       witty return-reminder drafts
    lookbookAgent.js    outfit curation, per-body styling tips, Veo prompt builder
    squadSyncAgent.js   event -> color-coordinated per-member looks
    rouletteAgent.js     one fusion pick per member
    votingAgent.js       Fit Check tally -> 0-100 gauge score
    influencerAgent.js   pluggable inspo source, filters to last 3 months
    orchestrator.js       agent roster surfaced to the UI

public/
  index.html, styles.css, app.js
  modules/            one file per feature area (closet, lookbook, fitroom, squadsync, roulette, inspo, agents, api, toast)
```

State sync is push-based: every mutating route broadcasts a typed event over a single `/api/events` SSE stream, and every open tab (including the WebRTC signaling itself) reacts to it. This is what makes the grey-out banners, the vote gauge, and the call handshake update live across two browser tabs without a page refresh.

## Why zero dependencies

This environment's `npm install` is blocked by organization egress policy (the npm registry returns `403`). Rather than working around that, the whole app is built on Node's built-ins (`http`, `fs`, `crypto`-free WebRTC signaling via SSE + REST) and native browser APIs (ES modules, `RTCPeerConnection`, `EventSource`, `getUserMedia`) — no React, no Express, no Socket.io, no bundler. If your environment has registry access, this still runs as-is; you're just not required to `npm install` anything first.

## What's simulated vs. real

- **WebRTC video/audio calling is real** — genuine peer-to-peer `RTCPeerConnection`s, tested with two live browser contexts exchanging actual media tracks.
- **The "Watch AI Video Runway" animation is a CSS motion simulation**, always available with no setup. Right next to it, **"Generate real video (Veo)" calls the actual Gemini API's Veo video-generation endpoint** (`geminiClient.generateVideo`) when `GEMINI_API_KEY` is set: it submits the same cinematic prompt as a long-running job, polls until it finishes (up to ~6 minutes), downloads the resulting MP4, and plays it in the page. This integration is **unverified against a live key** — this environment has none to test with — so if Google has changed the request/response shape since this was written, check [ai.google.dev/gemini-api/docs/video](https://ai.google.dev/gemini-api/docs/video) and adjust `geminiClient.js`. Errors (missing key, no Veo access, timeout) surface directly in the UI rather than failing silently.
- **Influencer posts are real when `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ID` are set** — `influencerAgent.fetchFromProvider()` calls Instagram's Business Discovery API and maps real captions, timestamps, like counts, and post images into the UI. Without those two variables it falls back to deterministic mock data (same 3-month filter either way), so the feature is always demoable.
- **Gemini text generation is real when `GEMINI_API_KEY` is set**, and degrades to hand-written templates otherwise — every agent was designed to be fully demoable without any key.

## Testing performed

- Full backend route smoke test via `curl` (claim/release/laundry, nudge, lookbook curate, squad sync, roulette, vote, influencer add + inspo).
- End-to-end Playwright run across two browser contexts with fake camera/mic devices: closet load + pre-claimed banner, claim + nudge flow, lookbook curate + perspective switch + Veo prompt export, squad sync, roulette, influencer inspo, agents roster, and a real two-tab WebRTC connection with live cross-tab voting/gauge/emoji sync — zero console errors.

## Next steps if you want to go further

- Swap the in-memory store for a real database (closet items and votes currently reset on server restart).
- Add authentication so "claim as…" isn't a free-for-all dropdown.
- Verify the Veo integration against a real, Veo-enabled `GEMINI_API_KEY` and adjust `geminiClient.generateVideo()` if Google's request/response shape has moved on.
- The Instagram Business Discovery integration needs a Meta developer app review for production use beyond your own test accounts — see Meta's app review docs before shipping this to real users.
- `public/generated/` accumulates one MP4 per Veo request with no cleanup — add expiry/pruning before running this for real.
