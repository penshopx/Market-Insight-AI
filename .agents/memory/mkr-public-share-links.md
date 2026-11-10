---
name: MKR public share links
description: Security rules for sharing generated MKR PDFs with people who cannot access the authenticated platform.
---

MKR PDFs shared outside the team must use short-lived, HMAC-signed capability URLs backed by private object storage. Creating a link stays authenticated; only the tokenized PDF download is public.

**Why:** WhatsApp and `mailto:` cannot attach a browser-generated PDF, and linking back to an authenticated SPA prevents clients from downloading it. Bearer tokens in URL paths must also be redacted from request logs.

**How to apply:** Generate the PDF as a Blob without a local save, upload it through the authenticated API, then put the returned same-origin `/api/mkr-shares/…` URL in the message. Keep token expiry, namespace validation, `no-store`, and log redaction intact.