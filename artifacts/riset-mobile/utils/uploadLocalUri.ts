/**
 * Standalone photo upload utility — intentionally free of React so it can be
 * called from the offline-queue flush handler without needing an ImageField ref.
 */

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

/**
 * Upload a local file URI to the platform object storage.
 * Returns the serving URL that can be stored in the database.
 * Throws on failure (network or server error).
 */
export async function uploadLocalUri(localUri: string): Promise<string> {
  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const localBlob = await (await fetch(localUri)).blob();

  const uploadRes = await fetch(`${BASE_URL}/api/storage/upload`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: localBlob,
  });

  if (!uploadRes.ok) {
    const err = (await uploadRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Upload failed: ${uploadRes.status}`);
  }

  const { objectPath } = (await uploadRes.json()) as { objectPath: string };
  return `${BASE_URL}/api/storage${objectPath}`;
}

/**
 * Returns true if the error looks like a transient network issue (device is
 * offline or the connection dropped mid-request). Used to decide whether to
 * queue an item for retry rather than showing a hard failure dialog.
 */
export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : '';
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('connection refused') ||
    msg.includes('unable to connect') ||
    msg.includes('etimedout') ||
    msg.includes('timeout')
  );
}
