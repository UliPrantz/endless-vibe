export const BASE_DIMS = ['valence', 'arousal', 'acousticness', 'complexity'] as const;
export const EXTRA_DIMS = ['vocals', 'instrumentsDensity', 'bassWeight', 'heaviness'] as const;
export const ALL_DIMS = [...BASE_DIMS, ...EXTRA_DIMS] as const;

export type BaseDim = typeof BASE_DIMS[number];
export type ExtraDim = typeof EXTRA_DIMS[number];
export type DimName = typeof ALL_DIMS[number];

export interface DimMeta {
  label: string;
  shortHint: string;
  negPole: string;
  posPole: string;
}

export const DIM_META: Record<DimName, DimMeta> = {
  valence:            { label: 'Valence',           shortHint: 'Mood',         negPole: 'Negative',     posPole: 'Positive' },
  arousal:            { label: 'Arousal',           shortHint: 'Energy',       negPole: 'Calm',         posPole: 'Intense' },
  acousticness:       { label: 'Acousticness',      shortHint: 'Texture',      negPole: 'Acoustic',     posPole: 'Electronic' },
  complexity:         { label: 'Complexity',        shortHint: 'Composition',  negPole: 'Simple',       posPole: 'Complex' },
  vocals:             { label: 'Vocals',            shortHint: 'Voice',        negPole: 'Instrumental', posPole: 'Vocal-forward' },
  instrumentsDensity: { label: 'Instrument Density', shortHint: 'Layers',      negPole: 'Sparse',       posPole: 'Dense' },
  bassWeight:         { label: 'Bass Weight',       shortHint: 'Low end',      negPole: 'Light',        posPole: 'Heavy' },
  heaviness:          { label: 'Heaviness',         shortHint: 'Distortion',   negPole: 'Smooth',       posPole: 'Crushing' },
};
