import assert from "node:assert/strict";
import test from "node:test";
import {
  createMkrShareToken,
  MkrShareTokenError,
  verifyMkrShareToken,
} from "./mkrShareToken";

const SECRET = "test-only-secret";
const PATH = "/objects/uploads/test-pdf";

test("MKR share token round-trips its private object path", () => {
  const expiresAt = Date.now() + 60_000;
  const token = createMkrShareToken(PATH, expiresAt, SECRET);
  assert.deepEqual(verifyMkrShareToken(token, Date.now(), SECRET), {
    objectPath: PATH,
    expiresAt,
  });
});

test("tampered MKR share token is rejected", () => {
  const token = createMkrShareToken(PATH, Date.now() + 60_000, SECRET);
  assert.throws(
    () => verifyMkrShareToken(`${token}x`, Date.now(), SECRET),
    (error) =>
      error instanceof MkrShareTokenError && error.code === "INVALID",
  );
});

test("expired MKR share token is rejected", () => {
  const expiresAt = Date.now() + 1_000;
  const token = createMkrShareToken(PATH, expiresAt, SECRET);
  assert.throws(
    () => verifyMkrShareToken(token, expiresAt, SECRET),
    (error) =>
      error instanceof MkrShareTokenError && error.code === "EXPIRED",
  );
});