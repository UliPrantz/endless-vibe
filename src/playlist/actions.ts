import type { PlaylistState, QueueItem, Song } from '../types';

export const initialPlaylist: PlaylistState = { items: [], cursor: -1 };

export interface EnqueuePendingArgs {
  id: string;
  generationId: number;
}

export function enqueuePending(state: PlaylistState, { id, generationId }: EnqueuePendingArgs): PlaylistState {
  const item: QueueItem = {
    id,
    status: 'pending',
    song: null,
    attempts: 1,
    generationId,
    requestedAt: Date.now(),
  };
  return { ...state, items: [...state.items, item] };
}

export function bumpAttempt(state: PlaylistState, id: string, error?: string): PlaylistState {
  return {
    ...state,
    items: state.items.map(it =>
      it.id === id && it.status === 'pending'
        ? { ...it, attempts: it.attempts + 1, error }
        : it
    ),
  };
}

export function resolvePending(state: PlaylistState, id: string, song: Song): PlaylistState {
  const items = state.items.map(it =>
    it.id === id ? { ...it, status: 'ready' as const, song, error: undefined } : it
  );
  const idx = items.findIndex(it => it.id === id);
  // Auto-advance cursor onto the very first ready item so the first song starts playing.
  const cursor = state.cursor === -1 && idx === 0 ? 0 : state.cursor;
  return { ...state, items, cursor };
}

export function markFailed(state: PlaylistState, id: string, error: string): PlaylistState {
  return {
    ...state,
    items: state.items.map(it =>
      it.id === id ? { ...it, status: 'failed' as const, error } : it
    ),
  };
}

export function discardItem(state: PlaylistState, id: string): PlaylistState {
  const idx = state.items.findIndex(it => it.id === id);
  if (idx === -1) return state;
  const items = state.items.filter(it => it.id !== id);
  const cursor = idx <= state.cursor ? state.cursor - 1 : state.cursor;
  return { ...state, items, cursor };
}

export function advance(state: PlaylistState): PlaylistState {
  if (state.cursor + 1 >= state.items.length) return state;
  return { ...state, cursor: state.cursor + 1 };
}
