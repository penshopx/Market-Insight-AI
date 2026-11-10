/**
 * Pure-function helpers for photo-bukti (evidence photo) URL handling.
 *
 * Free of any React / React Native imports so they run in Node.js test
 * runners (e.g. the api-server test suite) without a React Native environment.
 */

/**
 * Returns true if a string looks like an image URL or base64 data URL.
 * Used to decide whether to show a photo thumbnail for a research item
 * or contractor note.
 */
export function isPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  // Common image extensions
  const lower = url.toLowerCase().split('?')[0];
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(lower)) return true;
  // Object storage patterns (uuid-style paths with no extension are common)
  if (/\/(objects|uploads|photos|files|storage|images)\//i.test(url)) return true;
  return false;
}

/**
 * Extract photo URL from kontraktor notes field.
 * Looks for pattern: [Foto bukti: <url>]
 */
export function extractFotoBuktiUrl(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(
    /\[Foto bukti:\s*(data:image\/[^;]+;base64,[^\]]+|https?:\/\/[^\]]+)\]/i,
  );
  return match ? match[1].trim() : null;
}
