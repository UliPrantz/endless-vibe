/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  READY = 'READY',
  ERROR = 'ERROR',
}

export interface Song {
  id: string;
  url: string;
  description: string;
  genre: string;
  valence: number;
  arousal: number;
  acousticness: number;
  complexity: number;
  customInstructions: string;
  createdAt: number;
  duration?: number;
}

export interface VibeState {
  valence: number; // -1 to 1
  arousal: number; // -1 to 1
  acousticness: number; // -1 to 1
  complexity: number; // -1 to 1
  genre: string;
  country?: string;
  customInstructions: string;
}

export interface PlaylistState {
  history: Song[];
  currentSong: Song | null;
  nextSong: Song | null;
  status: GenerationStatus;
}
