/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Song, VibeState } from "../types";

let aiInstance: GoogleGenAI | null = null;
let lyriaModelsCache: any[] = [];

/**
 * Returns a new instance of GoogleGenAI using the most current API key available.
 * Per the gemini-api skill, Lyria models require a selected API key usually found in process.env.API_KEY.
 */
function getAI(): GoogleGenAI {
  const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY) as string;
  if (!apiKey) {
    throw new Error("No API Key available. Please select an API key to continue.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function fetchLyriaModels(): Promise<string[]> {
  if (lyriaModelsCache.length > 0) {
    return lyriaModelsCache.map(m => m.name);
  }
  
  const ai = getAI();
  try {
    const modelsResponse = await ai.models.list();
    const models = [];
    for await (const model of modelsResponse) {
      if (model.name.includes("lyria")) {
         models.push(model);
      }
    }
    
    lyriaModelsCache = models;
    return lyriaModelsCache.map(m => m.name);
  } catch (error) {
    console.error("Failed to fetch models", error);
    return ["lyria-3-pro-preview", "lyria-3-clip-preview"]; // Fallback
  }
}


/**
 * Maps valence and arousal to descriptive words for better prompting.
 */
function getVibeDescription(vibe: VibeState): string {
  let vDesc = "";
  if (vibe.valence > 0.6) vDesc = "euphoric, exuberant, and joyous";
  else if (vibe.valence > 0.2) vDesc = "optimistic, pleasant, and warm";
  else if (vibe.valence > -0.2) vDesc = "balanced, neutral, and clear";
  else if (vibe.valence > -0.6) vDesc = "somber, melancholic, and cool";
  else vDesc = "despair, deep sorrow, and dark";

  let aDesc = "";
  if (vibe.arousal > 0.6) aDesc = "chaotic, intense, and pounding";
  else if (vibe.arousal > 0.2) aDesc = "active, rhythmic, and driving";
  else if (vibe.arousal > -0.2) aDesc = "steady, moderate pace";
  else if (vibe.arousal > -0.6) aDesc = "relaxed, gentle, and soft";
  else aDesc = "static, calm, and nearly silent";

  let acDesc = "";
  if (vibe.acousticness < -0.6) acDesc = "strictly acoustic, traditional instruments only";
  else if (vibe.acousticness < -0.2) acDesc = "mostly acoustic with subtle digital touches";
  else if (vibe.acousticness < 0.2) acDesc = "a balanced hybrid of organic and synthetic layers";
  else if (vibe.acousticness < 0.6) acDesc = "modern electronic with organic textures";
  else acDesc = "purely digital, synthesized, and futuristic";

  let cDesc = "";
  if (vibe.complexity > 0.6) cDesc = "avant-garde, intricate, and polyphonic";
  else if (vibe.complexity > 0.2) cDesc = "detailed and expressive";
  else if (vibe.complexity > -0.2) cDesc = "standard composition";
  else if (vibe.complexity > -0.6) cDesc = "uncomplicated, clean, and direct";
  else cDesc = "minimalist, repetitive, and sparse";

  let countryDesc = vibe.country ? ` Cultural context: ${vibe.country}.` : "";
  return `Mood Circle: ${vDesc} (${aDesc}). Character Circle: ${acDesc} (${cDesc}). Genre: ${vibe.genre}.${countryDesc}`;
}

/**
 * Uses Gemini to generate a detailed prompt for Lyria and a user-facing description.
 */
async function generateSongAttributes(vibe: VibeState, songsSinceLastChange: number): Promise<{ prompt: string; description: string }> {
  const ai = getAI();
  try {
    const vibeSummary = getVibeDescription(vibe);
    const systemInstruction = `You are a professional music producer and curator.
      Transform the following "Vibe Vectors" from a dual-circle control interface into a high-fidelity prompt for a music generation AI (Lyria) and a short 1-sentence user-facing session description.

      INPUT VECTORS (Range -1 to 1):
      Circle 1 (Mood Matrix):
      - Valence (Mood): ${vibe.valence.toFixed(2)} (Negative to Positive)
      - Arousal (Energy): ${vibe.arousal.toFixed(2)} (Low to High)

      Circle 2 (Instrument Character):
      - Acousticness: ${vibe.acousticness.toFixed(2)} (Acoustic to Electronic)
      - Complexity: ${vibe.complexity.toFixed(2)} (Simple to Complex)

      Metadata:
      - Genre: ${vibe.genre}
      - Region: ${vibe.country || 'Global'}
      - Semantic Mapping: ${vibeSummary}
      - Evolution Depth: ${songsSinceLastChange} songs since the last manual vibe change.
      ${vibe.customInstructions ? `- User Custom Style Instructions: "${vibe.customInstructions}"` : ""}

      STRICT INSTRUCTIONS:
      1. output 'lyriaPrompt': A dense, technical string of musical terms, specific instruments (consistent with the acousticness vector), tempo markers, and production style.
         - If ${songsSinceLastChange} > 0, introduce subtle variation (noise/drift) to avoid repetitive sequences while staying close to the core variables.
         - If User Custom Style Instructions are provided, prioritize them as stylistic overrides/additions. 
      2. output 'userDescription': A highly poetic, 5-8 word description that captures the unique intersection of these variables. Use evocative language.
      `;
      
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Generate the music attributes based on the current vibe parameters and historical evolution.",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lyriaPrompt: { type: Type.STRING },
            userDescription: { type: Type.STRING }
          },
          required: ["lyriaPrompt", "userDescription"]
        }
      }
    });

    const rawText = response.text || "{}";
    
    console.log(`\n\n=== [DEBUG] GEMINI PIPELINE EXECUTION ===\n[INSTRUCTION]:\n${systemInstruction}\n\n[RESPONSE.TEXT]:\n${rawText}\n=========================================\n\n`);

    const data = JSON.parse(rawText);

    return {
      prompt: data.lyriaPrompt || `A ${vibe.genre} track.`,
      description: data.userDescription || `A ${vibe.genre} session.`
    };
  } catch (error) {
    console.error("\n=== [DEBUG] GEMINI PIPELINE ERROR ===");
    console.error(error);
    console.error("=====================================\n");
    return {
      prompt: `A ${vibe.genre} track. Vibe: valence=${vibe.valence.toFixed(2)}, arousal=${vibe.arousal.toFixed(2)}, acousticness=${vibe.acousticness.toFixed(2)}, complexity=${vibe.complexity.toFixed(2)}.`,
      description: `A unique ${vibe.genre} soundscape based on your current vibe configuration.`
    };
  }
}

/**
 * Generates audio using Lyria Pro and returns a Blob URL.
 */
export async function generateSong(vibe: VibeState, audioModel: string = "lyria-3-pro-preview", songsSinceLastChange: number = 0): Promise<Song> {
  const ai = getAI();
  const { prompt, description } = await generateSongAttributes(vibe, songsSinceLastChange);
  
  const response = await ai.models.generateContentStream({
    model: audioModel,
    contents: prompt,
    config: {
      responseModalities: [Modality.AUDIO]
    },
  });

  let audioBase64 = "";
  let mimeType = "audio/wav";

  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part.inlineData?.data) {
        if (!audioBase64 && part.inlineData.mimeType) {
          mimeType = part.inlineData.mimeType;
        }
        audioBase64 += part.inlineData.data;
      }
    }
  }

  if (!audioBase64) {
    throw new Error("No audio data generated");
  }

  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);

  return {
    id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9),
    url,
    description,
    genre: vibe.genre,
    valence: vibe.valence,
    arousal: vibe.arousal,
    acousticness: vibe.acousticness,
    complexity: vibe.complexity,
    customInstructions: vibe.customInstructions,
    createdAt: Date.now(),
  };
}
