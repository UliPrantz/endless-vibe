# Endless Vibe

Endless Vibe is a small Vite + React + TypeScript app that generates an endless AI music stream from a visual "vibe" controller.

The user shapes the stream with mood, energy, acoustic/electronic character, complexity, genre, region, and optional custom instructions. The app turns those controls into a detailed music prompt with Gemini, asks Google's Lyria audio models to generate a track, buffers the next track, and crossfades between tracks for continuous playback.

This app is self-hostable and reads `GEMINI_API_KEY` from your Vite environment.

## What You Can Do

- Generate AI music from two circular XY pads:
  - Mood: valence and arousal
  - Character: acousticness and complexity
- Pick a genre and cultural context.
- Add custom style instructions, such as instrumentation or production notes.
- Choose from available Lyria models.
- Continuously play generated tracks with a buffered next track.
- Crossfade between tracks and skip manually.
- See current, buffered, and historical queue items.

## Tech Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS v4 through `@tailwindcss/vite`
- `motion` / `motion/react` for animation
- `lucide-react` for icons
- `@google/genai` for Gemini and Lyria calls
- Browser audio APIs for playback, Blob URLs, and crossfading
- npm with `package-lock.json`

There is no active backend in this repository. `express` is currently listed as a dependency, but the app code is a client-side Vite SPA.

## Local Development

Prerequisite: Node.js.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Choose one API key source:

   - Option A (recommended for local dev): create `.env.local` from `.env.example` and set:

   ```sh
   GEMINI_API_KEY="your-key"
   ```

   - Option B (runtime): paste a key into the in-app API key field in the header. It is stored in browser `localStorage` on that device.

3. Start the dev server:

   ```sh
   npm run dev
   ```

The dev server runs Vite on port `3000` and binds to `0.0.0.0`.

## Scripts

- `npm run dev`: start Vite on port `3000`
- `npm run build`: build the static app into `dist`
- `npm run preview`: preview the production build
- `npm run clean`: remove `dist`
- `npm run lint`: run TypeScript checking with `tsc --noEmit`
- `npm run test:run`: run the full Vitest suite
- `npm run test:browser:run`: run browser-mode Vitest tests in Chromium

## Hosting

### Static Hosting

The built output is a normal Vite static bundle, so it can be hosted on services like Vercel, Netlify, Firebase Hosting, Cloudflare Pages, or any static file host:

```sh
npm run build
```

Then publish the `dist` directory.

Important runtime note: in a purely static frontend, `GEMINI_API_KEY` is bundled client-side and can be exposed. For production, prefer a small backend/API proxy to keep secrets server-side.

### Server or Cloud Run

If deploying to Cloud Run or another server platform, use the Vite build as the static frontend. For a production-grade setup, add a small backend endpoint for Gemini/Lyria calls so the API key stays private. The current repo does not include that backend yet.

## Architecture Notes For Coding Agents

This section is intentionally explicit so future coding agents can use the README as durable project context.

### Testing Architecture

- Unit tests run in Vitest's `jsdom` project. Use them for reducers, selectors,
  hook state transitions, and fast playback-engine checks with faked audio
  elements.
- Browser tests run in Vitest's browser project with Playwright/Chromium. Use
  them sparingly for behavior that depends on real browser APIs. The autoplay
  and crossfade regression lives here because real `<audio>` playback,
  `currentTime`, `duration`, `paused`, and media events could not be debugged
  reliably with mocks alone.
- Browser mode is also useful for in-place debugging when agents need a full
  feedback loop inside the repo instead of copying logs or manual observations
  back and forth. Do not use it as the default for ordinary React rendering or
  pure logic tests; keep those in unit tests so the suite stays quick and easy
  to reason about.
- Mock external music generation at `src/services/musicService.ts` for tests.
  Browser playback tests use committed WAV fixtures in `src/test/fixtures/` so
  Chromium decodes real audio while avoiding Google API calls.

### Current Shape

- `index.html` mounts the React app at `#root`.
- `src/main.tsx` creates the React root and renders `App`.
- `src/App.tsx` is the orchestration hub. It owns API key state, vibe controls
  (basic and advanced), the playlist state, generation retries, and the
  Apply-Vibe / Skip / Play-Pause UI. It does **not** own audio playback —
  that is delegated to the playback engine hook.
- `src/playback/usePlaybackEngine.ts` is the two-element crossfade engine.
  Given `currentSong`, `nextReadySong`, and a `crossfadeDuration`, it manages
  two `<audio>` elements (A and B), preloads the next track on the inactive
  element, and crossfades on song end or near-end. `isPlaying` is a one-way
  source of truth — DOM audio events do not feed back into it. The hook
  exposes `togglePlayPause`, `start`, and `skip`.
- `src/playlist/` is the playlist domain.
  - `actions.ts` — pure reducers: `enqueuePending`, `bumpAttempt`,
    `resolvePending`, `markFailed`, `discardItem`, `advance`.
  - `selectors.ts` — derived reads: `getCurrentSong`, `getNextReadySong`,
    `isAnyPending`, `upcomingReadyCount`, etc.
  - The playlist is a flat list of `QueueItem`s with a `cursor` index. Items
    can be `pending`, `ready`, or `failed`. The cursor auto-advances onto
    the very first `ready` item.
- `src/services/musicService.ts` owns all Google GenAI integration:
  - `fetchLyriaModels()` lists available Lyria models (with a fallback list).
  - `generateSong()` delegates to `src/musicPipeline/` and returns a `Song`.
- `src/musicPipeline/` is the decoupled two-step generation pipeline:
  - `prompt.ts` — builds a Gemini system prompt from vibe inputs.
  - `gemini.ts` — Gemini step that condenses vibe inputs into a Lyria prompt
    plus a short user-facing description.
  - `lyria.ts` — Lyria step that streams audio and returns bytes + Blob URL.
  - `pipeline.ts` — composes Gemini + Lyria into one call.
  - `retry.ts` — retry/backoff helpers used by both steps.
  - `dims.ts` — dimension catalog for basic and advanced vibe controls.
  - `resolveVibe.ts` — turns UI state (basic or advanced) into a `VibeInputs`
    payload, rolling random values for unlocked advanced sliders.
- `src/types.ts` defines the domain model: `Song`, `VibeState`,
  `AdvancedVibeState`, `AdvancedDims`, `DimSliderState`, `PlaylistState`,
  `QueueItem`, `QueueItemStatus`, `VibeMode`.
- `src/components/`:
  - `VibePad.tsx` — XY pad used by Basic mode.
  - `AdvancedMixer.tsx` + `LockableSlider.tsx` — Advanced mode sliders with
    lockable single-value or random-range modes.
  - `ModeToggle.tsx` — switch between Basic and Advanced.
  - `VibeMetadataControls.tsx` — genre buttons, country select, custom style.
  - `SidebarQueue.tsx` — past/current/upcoming queue items.
  - `APIKeyOverlay.tsx` — generation/API key failure overlay.
- `src/lib/`:
  - `utils.ts` — `cn()` class name merge.
  - `apiKeyStore.ts` — reads/writes the Gemini key from `localStorage` with
    a fallback to `process.env.GEMINI_API_KEY`.
- `src/index.css` imports Tailwind, configures fonts, and defines small
  shared CSS utilities (custom scrollbar, dual-range slider thumbs).

### Runtime Flow

1. On load, `App` checks whether a Gemini API key is resolvable
   (`localStorage` first, then `process.env.GEMINI_API_KEY`).
2. If a key is available, it fetches Lyria models through `fetchLyriaModels()`.
3. The user adjusts draft vibe controls (basic XY pads or advanced sliders).
4. Pressing "Apply Vibe" copies the draft vibe to the active vibe, resets
   the evolution counter, and triggers the first generation.
5. `triggerNextGeneration()` enqueues a `pending` item, then runs up to
   `MAX_GENERATION_ATTEMPTS` (5) attempts. Each attempt calls
   `generateSong()`, which asks Gemini for a Lyria prompt + description and
   then asks Lyria for streamed audio that's assembled into a Blob URL.
6. On success, the queue item is resolved with the `Song`. The cursor
   auto-advances onto the first ready item, so the first song starts
   playing automatically.
7. While playing, a buffer effect keeps `upcomingReadyCount(playlist) >=
   bufferDepth` by triggering more generations.
8. The playback engine preloads the next ready song on the inactive audio
   element. Near the end of the active track (within `crossfadeDuration`
   seconds), it flips `activePlayer`, fades the outgoing element down, and
   fades the incoming one up. The cursor advances in the same tick.
9. If the active track ends before the next item is ready, the cursor can
   advance onto the pending item. The UI shows the finished song as history and
   the pending item as generating; playback resumes automatically when that
   item resolves.
10. Manual Skip goes through the same advance path. If there is no next queue
   item at all, skip is a no-op.

### Important Invariants

- Draft vibe state (`draftBasicDims`, `draftAdvancedDims`, `mode`) represents
  UI edits that may not yet be applied. Active vibe state (`activeBasicDims`,
  `activeAdvancedDims`, `activeMode`) is what subsequent generations use.
- `playlist.cursor` points at the currently audible song. Items before the
  cursor are past; items after are upcoming. The cursor only moves forward.
- `getNextReadySong(playlist)` returns the next `ready` item after the
  cursor — but only if no `pending` item sits between (so we don't skip
  over a still-generating slot).
- `activePlayer` alternates between audio element A and B so the outgoing
  track can fade out while the incoming track fades in.
- `isPlaying` in the playback engine is **one-way**: it drives the audio
  elements. The audio elements' native `pause`/`play` DOM events are NOT
  wired back into React state — that previously caused autoplay to break
  when a fade-out pause flipped `isPlaying` off mid-crossfade.
- `generationIdRef` (in `App.tsx`) cancels stale async generations when a
  newer Apply-Vibe request supersedes older ones.
- Object URLs created for generated audio leak across the session — there
  is no revocation step yet. Acceptable for now since sessions are short.
- The app is browser-first. Avoid adding Node-only APIs to frontend code.

### Known Constraints

- The Gemini key is wired through Vite's `define` config as
  `process.env.GEMINI_API_KEY`. The runtime app reads it via
  `getResolvedApiKey()` in `src/lib/apiKeyStore.ts`.
- There is no route system, global state library, database, or backend
  API layer.
- Generated audio is kept in memory as Blob URLs, not persisted.
- The queue/history is session-only and resets on refresh.
- `express` and `@types/express` are installed but unused — safe to remove
  in a follow-up.

### Agent Guidance

- Keep changes close to the existing React/Vite SPA architecture unless
  the task explicitly asks for a backend or larger restructuring.
- `src/App.tsx` is the orchestration hub; push playback concerns into
  `src/playback/`, playlist concerns into `src/playlist/`, and generation
  concerns into `src/musicPipeline/` or `src/services/`.
- Keep Google API calls centralized in `src/services/musicService.ts`.
- Preserve the two-player crossfade model and the one-way `isPlaying`
  contract in the playback engine. Do not wire audio DOM events back into
  React state.
- Manual Skip and auto-crossfade share the same `advance()` path. Keep
  them unified so playlist invariants only need to hold in one place.
- If making the app production-grade, move Gemini/Lyria calls behind a
  backend proxy so keys are not exposed to browsers.
- Run `npm run lint` after TypeScript changes.
