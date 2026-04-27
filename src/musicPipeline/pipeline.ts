import { GoogleGenAI } from "@google/genai";
import { bytesToBlobUrl } from "./audio";
import { generateLyriaPrompt } from "./gemini";
import { generateAudioBytes } from "./lyria";
import { buildGeminiSystemPrompt } from "./prompt";
import { GenerateMusicOptions, MusicPipelineResult } from "./types";

export async function generateMusic(options: GenerateMusicOptions): Promise<MusicPipelineResult> {
  const geminiModel = options.geminiModel ?? "gemini-2.5-flash";
  const lyriaModel = options.lyriaModel ?? "lyria-3-pro-preview";
  const songsSinceLastChange = options.songsSinceLastChange ?? 0;
  const buildSystemPrompt = options.buildSystemPrompt ?? buildGeminiSystemPrompt;
  const systemPrompt = buildSystemPrompt(options.vibe, songsSinceLastChange);

  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const { lyriaPrompt, userDescription } = await generateLyriaPrompt(ai, {
    systemPrompt,
    model: geminiModel,
    retry: options.retry?.gemini,
    signal: options.signal,
    logger: options.logger,
  });

  const { audioBytes, mimeType } = await generateAudioBytes(ai, {
    prompt: lyriaPrompt,
    model: lyriaModel,
    retry: options.retry?.lyria,
    signal: options.signal,
    logger: options.logger,
  });

  const blobUrl = bytesToBlobUrl(audioBytes, mimeType);
  return {
    audioBytes,
    mimeType,
    blobUrl,
    lyriaPrompt,
    userDescription,
    geminiModel,
    lyriaModel,
  };
}
