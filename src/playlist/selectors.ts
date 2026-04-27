import type { PlaylistState, QueueItem, Song } from '../types';

export const getCurrent = (s: PlaylistState): QueueItem | null =>
  s.cursor >= 0 ? s.items[s.cursor] ?? null : null;

export const getCurrentSong = (s: PlaylistState): Song | null =>
  getCurrent(s)?.song ?? null;

export const getPast = (s: PlaylistState): QueueItem[] =>
  s.cursor > 0 ? s.items.slice(0, s.cursor) : [];

export const getUpcoming = (s: PlaylistState): QueueItem[] =>
  s.cursor >= -1 ? s.items.slice(s.cursor + 1) : s.items;

export const getNextReadyItem = (s: PlaylistState): QueueItem | null => {
  for (let i = s.cursor + 1; i < s.items.length; i++) {
    const item = s.items[i];
    if (item.status === 'ready') return item;
    if (item.status === 'failed') continue;
    return null;
  }
  return null;
};

export const getNextReadySong = (s: PlaylistState): Song | null =>
  getNextReadyItem(s)?.song ?? null;

export const isAnyPending = (s: PlaylistState): boolean =>
  s.items.some(i => i.status === 'pending');

export const upcomingReadyCount = (s: PlaylistState): number => {
  let n = 0;
  for (let i = s.cursor + 1; i < s.items.length; i++) {
    if (s.items[i].status === 'ready') n++;
  }
  return n;
};
