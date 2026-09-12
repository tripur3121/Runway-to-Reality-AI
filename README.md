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

- `GEMINI_API_KEY` — when set, the Nudge, Lookbook, and Squad Sync agents call Gemini (`gemini-2.0-flash`) live for text generation. Without it, every agent falls back to a curated template bank, so the app is fully functional offline/out of the box.
- `INFLUENCER_API_KEY` — placeholder hook for a real social provider (see Influencer Inspo below). Not required to demo the feature.
- `PORT` — defaults to `8787`.

## Feature tour

1. **Shared Closet with Detailed Specs** — filter by Maya's / Liam's / Sophie's / All Group Pool. Every piece carries Size, Fabric, and Brand. One tap flips Laundry Status between Fresh and In Hamper. Maya's Camel Trench Coat is pre-claimed by Liam on load, exactly to demonstrate #2 below.
2. **Real-Time Borrowing & Visual Grey-Out** — claiming a pool item greys out its photo and stamps a bold `TAKEN BY [NAME]` banner across it, live for every open tab (via Server-Sent Events). "Nudge" asks the Nudge Agent to draft a witty, non-passive-aggressive return-reminder text.
3. **"Same Fit, Different Member" AI Video Lookbook** — "Curate My Outfit" pulls a complementary set from the pool. "Watch AI Video Runway" plays an animated motion-runway simulation (CSS/SVG) that rescales per member height (Maya 5'5" S, Liam 6'1" L, Sophie 5'8" M) with tailored micro-styling tips per perspective, plus an exportable cinematic 4K prompt ready to paste into Google Veo.
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
- **The AI Video Lookbook "runway" is a CSS motion simulation**, not a generated video — there's no Veo API access wired up in this environment. What *is* real is the cinematic 4K prompt text generator, built to be pasted straight into Veo (or Sora, Runway, etc.) when you're ready to render.
- **Influencer posts are deterministic mock data**, seeded per handle, with an explicit 3-month filter applied — the same filter a real feed would need. `influencerAgent.fetchFromProvider()` is the single integration point: swap in Instagram Graph API / a licensed scraping provider behind `INFLUENCER_API_KEY` and the rest of the pipeline (filtering, rendering, "not older than 3 months") doesn't change.
- **Gemini text generation is real when `GEMINI_API_KEY` is set**, and degrades to hand-written templates otherwise — every agent was designed to be fully demoable without any key.

## Testing performed

- Full backend route smoke test via `curl` (claim/release/laundry, nudge, lookbook curate, squad sync, roulette, vote, influencer add + inspo).
- End-to-end Playwright run across two browser contexts with fake camera/mic devices: closet load + pre-claimed banner, claim + nudge flow, lookbook curate + perspective switch + Veo prompt export, squad sync, roulette, influencer inspo, agents roster, and a real two-tab WebRTC connection with live cross-tab voting/gauge/emoji sync — zero console errors.

## Next steps if you want to go further

- Swap the in-memory store for a real database (closet items and votes currently reset on server restart).
- Add authentication so "claim as…" isn't a free-for-all dropdown.
- Wire a real Veo/Sora API call behind the existing prompt builder once you have video-model access from this environment.
- Implement `influencerAgent.fetchFromProvider()` against Instagram Graph API (requires app review) or a licensed provider.
