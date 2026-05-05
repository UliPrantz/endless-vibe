// Helpers for browser-mode tests that mock `services/musicService` at the
// module boundary. The real <App/> imports `generateSong` and `fetchLyriaModels`
// from there; in tests we swap the implementations so each generation
// resolves with a Song pointing at one of the committed WAV fixtures.
//
// Usage in a test file:
//
//   vi.mock('../services/musicService', () => mockMusicServiceModule());
//   const fixtures = makeFixtureSongs();
//   queueSong(fixtures.silence12);
//   queueSong(fixtures.silence13);
//
// Then render <App/> as normal — generateSong() will return the queued songs
// in FIFO order. Each entry can be a Song (resolves immediately), a delay
// + Song (simulates slow generation), or an Error (simulates failure).

import { vi } from 'vitest';
import silence12sUrl from './fixtures/silence-12s.wav?url';
import silence13sUrl from './fixtures/silence-13s.wav?url';
import type { Song } from '../types';

export interface FixtureSong extends Song {
  /** The tail of the URL — useful for `audio.src.includes(tail)` assertions. */
  urlTail: string;
}

function makeFixtureSong(label: string, url: string, durationSeconds: number): FixtureSong {
  return {
    id: label,
    url,
    urlTail: url.split('/').pop() || url,
    description: `fixture: ${label}`,
    genre: 'Pop',
    valence: 0,
    arousal: 0,
    acousticness: 0,
    complexity: 0,
    customInstructions: '',
    createdAt: 0,
    duration: durationSeconds,
  };
}

export function makeFixtureSongs() {
  return {
    silence12: makeFixtureSong('silence-12', silence12sUrl, 12),
    silence13: makeFixtureSong('silence-13', silence13sUrl, 13),
  };
}

type QueueEntry =
  | { kind: 'song'; song: Song; delayMs?: number }
  | { kind: 'error'; error: Error; delayMs?: number };

const queue: QueueEntry[] = [];

export function queueSong(song: Song, delayMs = 0) {
  queue.push({ kind: 'song', song, delayMs });
}

export function queueError(error: Error, delayMs = 0) {
  queue.push({ kind: 'error', error, delayMs });
}

export function resetMusicServiceMock() {
  queue.length = 0;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Returns the implementation object for `vi.mock('../services/musicService',
 * () => mockMusicServiceModule())`. Tests call queueSong/queueError before
 * triggering generation; generateSong() consumes entries in FIFO order.
 */
export function mockMusicServiceModule() {
  return {
    fetchLyriaModels: async () => ['lyria-3-pro-preview'],
    generateSong: async (): Promise<Song> => {
      const next = queue.shift();
      if (!next) {
        throw new Error('mockMusicService: no more queued songs/errors');
      }
      if (next.delayMs) await sleep(next.delayMs);
      if (next.kind === 'error') throw next.error;
      return next.song;
    },
  };
}
