import { GoogleGenAI, Type } from "@google/genai";
import { GenerateLyriaPromptOptions } from "./types";
import { withRetry } from "./retry";

function parsePromptPayload(rawText: string): { lyriaPrompt: string; userDescription: string } {
  if (!rawText.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed = JSON.parse(rawText) as { lyriaPrompt?: string; userDescription?: string };
  const lyriaPrompt = parsed.lyriaPrompt?.trim();
  const userDescription = parsed.userDescription?.trim();

  if (!lyriaPrompt || !userDescription) {
    throw new Error("Gemini response was missing required fields.");
  }

  return { lyriaPrompt, userDescription };
}

export async function generateLyriaPrompt(
  ai: GoogleGenAI,
  options: GenerateLyriaPromptOptions,
): Promise<{ lyriaPrompt: string; userDescription: string }> {
  options.logger?.({ type: "gemini:start", systemPrompt: options.systemPrompt });

  return withRetry(
    async () => {
      const response = await ai.models.generateContent({
        model: options.model,
        contents: "Generate the music attributes based on the current vibe parameters and historical evolution.",
        config: {
          systemInstruction: options.systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lyriaPrompt: { type: Type.STRING },
              userDescription: { type: Type.STRING },
            },
            required: ["lyriaPrompt", "userDescription"],
          },
        },
      });

      const parsed = parsePromptPayload(response.text || "");
      options.logger?.({
        type: "gemini:success",
        lyriaPrompt: parsed.lyriaPrompt,
        userDescription: parsed.userDescription,
      });
      return parsed;
    },
    {
      ...options.retry,
      onAttempt: ({ attempt, error }) => {
        options.logger?.({ type: "gemini:retry", attempt, error: error ?? new Error("Unknown Gemini error") });
        options.retry?.onAttempt?.({ attempt, error });
      },
    },
    options.signal,
  );
}
