import { GoogleGenAI, Modality } from "@google/genai";
import { base64ToBytes } from "./audio";
import { GenerateAudioBytesOptions } from "./types";
import { withRetry } from "./retry";

export async function generateAudioBytes(
  ai: GoogleGenAI,
  options: GenerateAudioBytesOptions,
): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  options.logger?.({ type: "lyria:start", lyriaPrompt: options.prompt, model: options.model });

  return withRetry(
    async () => {
      const stream = await ai.models.generateContentStream({
        model: options.model,
        contents: options.prompt,
        config: {
          responseModalities: [Modality.AUDIO],
        },
      });

      let audioBase64 = "";
      let mimeType = "audio/wav";

      for await (const chunk of stream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;

        for (const part of parts) {
          if (!part.inlineData?.data) continue;
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
      }

      if (!audioBase64) {
        throw new Error("No audio data generated");
      }

      const audioBytes = base64ToBytes(audioBase64);
      options.logger?.({ type: "lyria:success", bytes: audioBytes.byteLength, mimeType });
      return { audioBytes, mimeType };
    },
    {
      ...options.retry,
      onAttempt: ({ attempt, error }) => {
        options.logger?.({ type: "lyria:retry", attempt, error: error ?? new Error("Unknown Lyria error") });
        options.retry?.onAttempt?.({ attempt, error });
      },
    },
    options.signal,
  );
}
