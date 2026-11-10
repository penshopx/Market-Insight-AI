import { Readable } from "stream";
import express, { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateMkrShareResponse,
  DownloadMkrShareParams,
} from "@workspace/api-zod";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import {
  createMkrShareToken,
  getMkrShareSigningSecret,
  MkrShareTokenError,
  verifyMkrShareToken,
} from "../lib/mkrShareToken";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

router.post(
  "/mkr-shares",
  express.raw({
    type: ["application/pdf", "application/octet-stream"],
    limit: MAX_PDF_BYTES,
  }),
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0 || !isPdf(body)) {
      res.status(400).json({ error: "Request body must be a valid PDF" });
      return;
    }

    if (body.length > MAX_PDF_BYTES) {
      res.status(400).json({ error: "PDF exceeds the 15 MB size limit" });
      return;
    }

    try {
      const signingSecret = getMkrShareSigningSecret();
      const { objectPath } = await objectStorageService.uploadObjectEntity(
        body,
        "application/pdf",
      );
      const expiresAtMs = Date.now() + SHARE_TTL_MS;
      const token = createMkrShareToken(
        objectPath,
        expiresAtMs,
        signingSecret,
      );

      res.status(201).json(
        CreateMkrShareResponse.parse({
          downloadPath: `/api/mkr-shares/${token}`,
          expiresAt: new Date(expiresAtMs).toISOString(),
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to create MKR PDF share");
      res.status(500).json({ error: "Failed to create MKR PDF share" });
    }
  },
);

router.get(
  "/mkr-shares/:token",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = DownloadMkrShareParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(404).json({ error: "MKR share link not found" });
      return;
    }

    try {
      const { objectPath } = verifyMkrShareToken(parsed.data.token);
      const objectFile =
        await objectStorageService.getObjectEntityFile(objectPath);
      const response = await objectStorageService.downloadObject(objectFile, 0);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="MKR-Executive-Brief.pdf"',
      );
      res.setHeader("Cache-Control", "private, no-store");

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof MkrShareTokenError) {
        const status = error.code === "EXPIRED" ? 410 : 404;
        res.status(status).json({
          error:
            error.code === "EXPIRED"
              ? "Tautan PDF MKR sudah kedaluwarsa"
              : "Tautan PDF MKR tidak valid",
        });
        return;
      }
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "PDF MKR tidak ditemukan" });
        return;
      }
      req.log.error({ err: error }, "Failed to download shared MKR PDF");
      res.status(500).json({ error: "Failed to download MKR PDF" });
    }
  },
);

export default router;