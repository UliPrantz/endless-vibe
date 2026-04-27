const STORAGE_KEY = "endless-vibe-gemini-api-key";

function readFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getResolvedApiKey(): string | null {
  return readFromStorage() ?? (process.env.GEMINI_API_KEY?.trim() || null);
}

export function setStoredApiKey(apiKey: string): void {
  if (typeof window === "undefined") return;
  const trimmed = apiKey.trim();
  if (!trimmed) return;
  window.localStorage.setItem(STORAGE_KEY, trimmed);
}

export function clearStoredApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
