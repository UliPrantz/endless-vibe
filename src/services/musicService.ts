/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { Song } from "../types";
import { generateMusic } from "../musicPipeline";
import { getResolvedApiKey } from "../lib/apiKeyStore";
import type { PipelineEvent, RetryOptions, VibeInputs } from "../musicPipeline";

const FALLBACK_LYRIA_MODELS = ["lyria-3-pro-preview", "lyria-3-clip-preview"];

let lyriaModelsCache: string[] | null = null;

function getApiKey(): string {
  const apiKey = getResolvedApiKey();
  if (!apiKey) {
    throw new Error("No API key configured. Set GEMINI_API_KEY in .env.local or add one in the app header.");
  }
  return apiKey;
}

export async function fetchLyriaModels(): Promise<string[]> {
  if (lyriaModelsCache) return lyriaModelsCache;

  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  try {
    const modelsResponse = await ai.models.list();
    const names: string[] = [];
    for await (const model of modelsResponse) {
      if (model.name?.includes("lyria")) names.push(model.name);
    }
    lyriaModelsCache = names.length ? names : FALLBACK_LYRIA_MODELS;
    return lyriaModelsCache;
  } catch (error) {
    console.error("Failed to fetch models", error);
    return FALLBACK_LYRIA_MODELS;
  }
}

export interface GenerateSongOptions {
  signal?: AbortSignal;
  logger?: (event: PipelineEvent) => void;
  retry?: {
    gemini?: RetryOptions;
    lyria?: RetryOptions;
  };
}

export async function generateSong(
  vibe: VibeInputs,
  audioModel: string = "lyria-3-pro-preview",
  songsSinceLastChange: number = 0,
  options: GenerateSongOptions = {},
): Promise<Song> {
  const result = await generateMusic({
    apiKey: getApiKey(),
    vibe,
    lyriaModel: audioModel,
    songsSinceLastChange,
    signal: options.signal,
    logger: options.logger,
    retry: options.retry,
  });

  return {
    id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9),
    url: result.blobUrl,
    description: result.userDescription,
    genre: vibe.genre,
    valence: vibe.valence,
    arousal: vibe.arousal,
    acousticness: vibe.acousticness,
    complexity: vibe.complexity,
    customInstructions: vibe.customInstructions ?? "",
    createdAt: Date.now(),
  };
}
