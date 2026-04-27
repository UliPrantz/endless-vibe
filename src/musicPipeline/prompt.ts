import { VibeInputs } from "./types";

function getVibeDescription(vibe: VibeInputs): string {
  let valenceDescription = "";
  if (vibe.valence > 0.6) valenceDescription = "euphoric, exuberant, and joyous";
  else if (vibe.valence > 0.2) valenceDescription = "optimistic, pleasant, and warm";
  else if (vibe.valence > -0.2) valenceDescription = "balanced, neutral, and clear";
  else if (vibe.valence > -0.6) valenceDescription = "somber, melancholic, and cool";
  else valenceDescription = "despair, deep sorrow, and dark";

  let arousalDescription = "";
  if (vibe.arousal > 0.6) arousalDescription = "chaotic, intense, and pounding";
  else if (vibe.arousal > 0.2) arousalDescription = "active, rhythmic, and driving";
  else if (vibe.arousal > -0.2) arousalDescription = "steady, moderate pace";
  else if (vibe.arousal > -0.6) arousalDescription = "relaxed, gentle, and soft";
  else arousalDescription = "static, calm, and nearly silent";

  let acousticnessDescription = "";
  if (vibe.acousticness < -0.6) acousticnessDescription = "strictly acoustic, traditional instruments only";
  else if (vibe.acousticness < -0.2) acousticnessDescription = "mostly acoustic with subtle digital touches";
  else if (vibe.acousticness < 0.2) acousticnessDescription = "a balanced hybrid of organic and synthetic layers";
  else if (vibe.acousticness < 0.6) acousticnessDescription = "modern electronic with organic textures";
  else acousticnessDescription = "purely digital, synthesized, and futuristic";

  let complexityDescription = "";
  if (vibe.complexity > 0.6) complexityDescription = "avant-garde, intricate, and polyphonic";
  else if (vibe.complexity > 0.2) complexityDescription = "detailed and expressive";
  else if (vibe.complexity > -0.2) complexityDescription = "standard composition";
  else if (vibe.complexity > -0.6) complexityDescription = "uncomplicated, clean, and direct";
  else complexityDescription = "minimalist, repetitive, and sparse";

  const countryDescription = vibe.country ? ` Cultural context: ${vibe.country}.` : "";
  const advancedDescription = describeAdvancedExtras(vibe);
  return `Mood Circle: ${valenceDescription} (${arousalDescription}). Character Circle: ${acousticnessDescription} (${complexityDescription}). Genre: ${vibe.genre}.${countryDescription}${advancedDescription}`;
}

type Band = readonly [number, string];

// Bands ordered DESCENDING by threshold; first match wins, last entry is the
// fallback (its threshold should be -Infinity).
function pickBand(value: number, bands: readonly Band[]): string {
  for (const [threshold, label] of bands) {
    if (value > threshold) return label;
  }
  return bands[bands.length - 1][1];
}

const VOCALS_BANDS: readonly Band[] = [
  [0.6, "lead vocals dominant, expressive vocal performance front-and-center"],
  [0.2, "prominent vocals woven through the mix"],
  [-0.2, "occasional vocal phrases, mostly textural"],
  [-0.6, "sparse vocal samples or wordless vocalizations"],
  [-Infinity, "fully instrumental, no vocals"],
];

const INSTRUMENTS_DENSITY_BANDS: readonly Band[] = [
  [0.6, "densely layered arrangement, many overlapping instruments"],
  [0.2, "rich instrumentation with several active layers"],
  [-0.2, "balanced instrumentation, moderate layering"],
  [-0.6, "lean arrangement, few instruments active at once"],
  [-Infinity, "extremely sparse, only one or two instruments"],
];

const BASS_WEIGHT_BANDS: readonly Band[] = [
  [0.6, "earth-shaking sub-bass, heavy and dominant low end"],
  [0.2, "prominent and warm bass presence"],
  [-0.2, "balanced low end, neither thin nor heavy"],
  [-0.6, "light, controlled bass with clean low frequencies"],
  [-Infinity, "minimal low end, airy and bass-light"],
];

const HEAVINESS_BANDS: readonly Band[] = [
  [0.6, "crushing, distorted, abrasive textures"],
  [0.2, "gritty, edgy character with bite"],
  [-0.2, "moderately driven, some warmth and grit"],
  [-0.6, "smooth and clean, minimal distortion"],
  [-Infinity, "pristine, polished, completely smooth"],
];

function describeAdvancedExtras(vibe: VibeInputs): string {
  const parts: string[] = [];
  if (vibe.vocals !== undefined) parts.push(`Vocals: ${pickBand(vibe.vocals, VOCALS_BANDS)}`);
  if (vibe.instrumentsDensity !== undefined) parts.push(`Instrument density: ${pickBand(vibe.instrumentsDensity, INSTRUMENTS_DENSITY_BANDS)}`);
  if (vibe.bassWeight !== undefined) parts.push(`Bass weight: ${pickBand(vibe.bassWeight, BASS_WEIGHT_BANDS)}`);
  if (vibe.heaviness !== undefined) parts.push(`Heaviness: ${pickBand(vibe.heaviness, HEAVINESS_BANDS)}`);
  return parts.length ? ` Advanced character: ${parts.join("; ")}.` : "";
}

function buildAdvancedBlock(vibe: VibeInputs): string {
  const lines: string[] = [];
  if (vibe.vocals !== undefined) lines.push(`      - Vocals: ${vibe.vocals.toFixed(2)} (Instrumental to Vocal-forward)`);
  if (vibe.instrumentsDensity !== undefined) lines.push(`      - Instrument Density: ${vibe.instrumentsDensity.toFixed(2)} (Sparse to Dense)`);
  if (vibe.bassWeight !== undefined) lines.push(`      - Bass Weight: ${vibe.bassWeight.toFixed(2)} (Light to Heavy)`);
  if (vibe.heaviness !== undefined) lines.push(`      - Heaviness: ${vibe.heaviness.toFixed(2)} (Smooth to Crushing)`);
  if (lines.length === 0) return "";
  return `\n\n      Circle 3 (Advanced Character):\n${lines.join("\n")}`;
}

export function buildGeminiSystemPrompt(vibe: VibeInputs, songsSinceLastChange: number): string {
  const vibeSummary = getVibeDescription(vibe);
  const advancedBlock = buildAdvancedBlock(vibe);

  return `You are a professional music producer and curator.
      Transform the following "Vibe Vectors" from a dual-circle control interface into a high-fidelity prompt for a music generation AI (Lyria) and a short 1-sentence user-facing session description.

      INPUT VECTORS (Range -1 to 1):
      Circle 1 (Mood Matrix):
      - Valence (Mood): ${vibe.valence.toFixed(2)} (Negative to Positive)
      - Arousal (Energy): ${vibe.arousal.toFixed(2)} (Low to High)

      Circle 2 (Instrument Character):
      - Acousticness: ${vibe.acousticness.toFixed(2)} (Acoustic to Electronic)
      - Complexity: ${vibe.complexity.toFixed(2)} (Simple to Complex)${advancedBlock}

      Metadata:
      - Genre: ${vibe.genre}
      - Region: ${vibe.country || "Global"}
      - Semantic Mapping: ${vibeSummary}
      - Evolution Depth: ${songsSinceLastChange} songs since the last manual vibe change.
      ${vibe.customInstructions ? `- User Custom Style Instructions: "${vibe.customInstructions}"` : ""}

      STRICT INSTRUCTIONS:
      1. output 'lyriaPrompt': A dense, technical string of musical terms, specific instruments (consistent with the acousticness vector), tempo markers, and production style.
         - If ${songsSinceLastChange} > 0, introduce subtle variation (noise/drift) to avoid repetitive sequences while staying close to the core variables.
         - If User Custom Style Instructions are provided, prioritize them as stylistic overrides/additions.
      2. output 'userDescription': A highly poetic, 5-8 word description that captures the unique intersection of these variables. Use evocative language.
      `;
}
