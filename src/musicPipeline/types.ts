export interface VibeInputs {
  valence: number;
  arousal: number;
  acousticness: number;
  complexity: number;
  vocals?: number;
  instrumentsDensity?: number;
  bassWeight?: number;
  heaviness?: number;
  genre: string;
  country?: string;
  customInstructions?: string;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  isRetryable?: (error: unknown) => boolean;
  onAttempt?: (info: { attempt: number; error?: unknown }) => void;
}

export interface MusicPipelineResult {
  audioBytes: Uint8Array;
  mimeType: string;
  blobUrl: string;
  lyriaPrompt: string;
  userDescription: string;
  geminiModel: string;
  lyriaModel: string;
}

export type PipelineEvent =
  | { type: "gemini:start"; systemPrompt: string }
  | { type: "gemini:retry"; attempt: number; error: unknown }
  | { type: "gemini:success"; lyriaPrompt: string; userDescription: string }
  | { type: "lyria:start"; lyriaPrompt: string; model: string }
  | { type: "lyria:retry"; attempt: number; error: unknown }
  | { type: "lyria:success"; bytes: number; mimeType: string };

export interface GenerateMusicOptions {
  apiKey: string;
  vibe: VibeInputs;
  songsSinceLastChange?: number;
  geminiModel?: string;
  lyriaModel?: string;
  buildSystemPrompt?: (vibe: VibeInputs, songsSinceLastChange: number) => string;
  retry?: {
    gemini?: RetryOptions;
    lyria?: RetryOptions;
  };
  signal?: AbortSignal;
  logger?: (event: PipelineEvent) => void;
}

export interface GenerateLyriaPromptOptions {
  systemPrompt: string;
  model: string;
  retry?: RetryOptions;
  signal?: AbortSignal;
  logger?: (event: PipelineEvent) => void;
}

export interface GenerateAudioBytesOptions {
  prompt: string;
  model: string;
  retry?: RetryOptions;
  signal?: AbortSignal;
  logger?: (event: PipelineEvent) => void;
}
