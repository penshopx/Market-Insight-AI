/**
 * Re-export photo-bukti helpers from the shared workspace library so that
 * mobile code imports from a stable local path while the implementation lives
 * in a package that both the mobile app and the api-server test suite can
 * reference within their own TypeScript project boundaries.
 */
export { isPhotoUrl, extractFotoBuktiUrl } from '@workspace/photo-helpers';
