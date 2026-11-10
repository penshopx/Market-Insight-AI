import { randomUUID } from 'crypto';
import { Router, type Request, type Response } from 'express';
import express from 'express';
import { ObjectStorageService } from '../lib/objectStorage';

const router: Router = Router();
const objectStorageService = new ObjectStorageService();

// Magic-byte signatures for accepted image formats
const MAGIC_SIGNATURES: Array<{ mime: string; check: (b: Buffer) => boolean }> = [
  {
    mime: 'image/jpeg',
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    check: (b) =>
      b.length >= 4 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47,
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // "RIFF"
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,  // "WEBP"
  },
  {
    // HEIC/HEIF: 'ftyp' box at offset 4–7
    mime: 'image/heic',
    check: (b) =>
      b.length >= 12 &&
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  },
];

function detectImageMime(buf: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (sig.check(buf)) return sig.mime;
  }
  return null;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /storage/upload
 *
 * Server-side proxy image upload.
 * The client sends the raw image binary in the request body.
 * The server validates the content via magic bytes, then saves it directly
 * to GCS — no presigned URL or shared secret is exposed to the client.
 *
 * Returns: { objectPath: string }  (e.g. "/objects/uploads/<uuid>")
 */
router.post(
  '/storage/upload',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/octet-stream'],
    limit: `${MAX_BYTES}`,
  }),
  async (req: Request, res: Response) => {
    const body = req.body as Buffer;

    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: 'Request body must be raw image binary' });
      return;
    }

    if (body.length > MAX_BYTES) {
      res.status(400).json({ error: 'File too large. Maximum size is 10 MB.' });
      return;
    }

    const detectedMime = detectImageMime(body);
    if (!detectedMime) {
      res.status(400).json({ error: 'File does not appear to be a valid image (jpeg, png, webp, heic).' });
      return;
    }

    try {
      const { objectPath, cleanupUrl } = await objectStorageService.uploadObjectEntity(body, detectedMime);
      // cleanupUrl is a short-lived GCS signed DELETE URL the client can call
      // to remove this specific object if the associated DB record fails to save.
      res.json({ objectPath, cleanupUrl });
    } catch (error) {
      req.log.error({ err: error }, 'Error uploading image to storage');
      res.status(500).json({ error: 'Upload failed' });
    }
  },
);

export default router;
