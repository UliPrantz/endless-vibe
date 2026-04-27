import { VibeInputs } from "./types";
import { ALL_DIMS } from "./dims";
import {
  AdvancedVibeState,
  DimSliderState,
  RolledDimValues,
  VibeMode,
  VibeState,
} from "../types";

const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n));

function rollDim(s: DimSliderState): number {
  if (s.locked) return clamp(s.value);
  const lo = clamp(Math.min(s.min, s.max));
  const hi = clamp(Math.max(s.min, s.max));
  return lo + Math.random() * (hi - lo);
}

export interface ResolvedVibe {
  inputs: VibeInputs;
  rolled: RolledDimValues;
  mode: VibeMode;
}

export function resolveBasicVibe(v: VibeState): ResolvedVibe {
  const rolled: RolledDimValues = {
    valence: v.valence,
    arousal: v.arousal,
    acousticness: v.acousticness,
    complexity: v.complexity,
    vocals: 0,
    instrumentsDensity: 0,
    bassWeight: 0,
    heaviness: 0,
  };
  return {
    mode: 'basic',
    rolled,
    inputs: {
      valence: v.valence,
      arousal: v.arousal,
      acousticness: v.acousticness,
      complexity: v.complexity,
      // Extras intentionally omitted so the prompt builder skips the Circle 3 block.
      genre: v.genre,
      country: v.country,
      customInstructions: v.customInstructions,
    },
  };
}

export function resolveAdvancedVibe(v: AdvancedVibeState): ResolvedVibe {
  const rolled = {} as RolledDimValues;
  for (const d of ALL_DIMS) rolled[d] = rollDim(v.dims[d]);

  return {
    mode: 'advanced',
    rolled,
    inputs: {
      valence: rolled.valence,
      arousal: rolled.arousal,
      acousticness: rolled.acousticness,
      complexity: rolled.complexity,
      vocals: rolled.vocals,
      instrumentsDensity: rolled.instrumentsDensity,
      bassWeight: rolled.bassWeight,
      heaviness: rolled.heaviness,
      genre: v.genre,
      country: v.country,
      customInstructions: v.customInstructions,
    },
  };
}
