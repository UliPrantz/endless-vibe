export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBlobUrl(bytes: Uint8Array, mimeType: string): string {
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}
