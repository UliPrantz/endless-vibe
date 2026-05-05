# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

[README.md](README.md) contains a detailed, agent-oriented "Architecture Notes For Coding Agents" section (current shape, runtime flow, invariants, agent guidance). Read it before making non-trivial changes — the notes there are durable project context, not user-facing fluff. This file only adds what is not in the README.

## Commands

- `npm run dev` — Vite dev server on port `3000`, bound to `0.0.0.0`. Set `DISABLE_HMR=true` to disable HMR (used by automation environments).
- `npm run build` — production build into `dist/`.
- `npm run preview` — serve the production build.
- `npm run lint` — `tsc --noEmit`. Run this after TypeScript changes; there is no ESLint config and no test suite.
- `npm run clean` — remove `dist/`.

There is no test runner configured — do not invent test commands.

## Environment

- `GEMINI_API_KEY` is read from `.env.local` (see `.env.example`) and injected at build time via Vite's `define` as `process.env.GEMINI_API_KEY`. The runtime app reads it through [src/lib/apiKeyStore.ts](src/lib/apiKeyStore.ts), which prefers `localStorage` over the env-bundled value.
- The `@` alias resolves to the repo root (see [vite.config.ts](vite.config.ts)), not to `src/`.

## Architecture quick map

The README covers this in depth. Briefly:

- [src/App.tsx](src/App.tsx) — orchestration hub (vibe state, playlist state, retries). Does NOT own audio playback.
- [src/playback/usePlaybackEngine.ts](src/playback/usePlaybackEngine.ts) — two-element A/B crossfade engine. `isPlaying` is one-way; do not wire DOM `play`/`pause` events back into React state.
- [src/playlist/](src/playlist/) — pure reducers (`actions.ts`) + selectors (`selectors.ts`) over a flat `QueueItem[]` with a forward-only `cursor`.
- [src/musicPipeline/](src/musicPipeline/) — two-step Gemini→Lyria pipeline with retry/backoff. Vibe UI state is normalized to `VibeInputs` via `resolveVibe.ts`.
- [src/services/musicService.ts](src/services/musicService.ts) — single entry point for Google GenAI calls.
- [src/types.ts](src/types.ts) — domain model.

## Constraints to respect

- Browser-first SPA; no Node-only APIs in frontend code. There is no backend in the repo (the `express` dep is unused).
- Manual Skip and auto-crossfade share the same `advance()` path — keep them unified.
- Generated audio Blob URLs are not revoked; sessions are intentionally short. Don't add cleanup that breaks crossfade timing without also fixing the engine.
- The Gemini key is bundled client-side in static builds — flag this if a task pushes toward production deployment.
