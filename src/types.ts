/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DimName } from "./musicPipeline/dims";

export type VibeMode = 'basic' | 'advanced';

export type RolledDimValues = Record<DimName, number>;

export interface Song {
  id: string;
  url: string;
  description: string;
  genre: string;
  valence: number;
  arousal: number;
  acousticness: number;
  complexity: number;
  // Present when the song was generated in Advanced mode. Holds the concrete
  // value used for every dim (including randomly-rolled ones), so the UI can
  // render a "currently playing" marker on each slider.
  advancedValues?: RolledDimValues;
  mode?: VibeMode;
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

export interface DimSliderState {
  locked: boolean;
  value: number;
  min: number;
  max: number;
}

export type AdvancedDims = Record<DimName, DimSliderState>;

export interface AdvancedVibeState {
  dims: AdvancedDims;
  genre: string;
  country?: string;
  customInstructions: string;
}

export type QueueItemStatus = 'pending' | 'ready' | 'failed';

export interface QueueItem {
  id: string;
  status: QueueItemStatus;
  song: Song | null;
  error?: string;
  attempts: number;
  generationId: number;
  requestedAt: number;
}

export interface PlaylistState {
  items: QueueItem[];
  cursor: number;
}
