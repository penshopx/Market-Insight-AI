import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { sendBriefingWhatsApp } from "./whatsappSender";

const originalFetch = globalThis.fetch;
const originalToken = process.env.WHATSAPP_TOKEN;
const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.WHATSAPP_TOKEN;
  else process.env.WHATSAPP_TOKEN = originalToken;
  if (originalPhoneNumberId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
});

describe("sendBriefingWhatsApp", () => {
  it("uploads and sends the daily briefing and intelligence report", async () => {
    process.env.WHATSAPP_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "test-phone-id";

    const calls: Array<{ url: string; body: unknown }> = [];
    let uploadCount = 0;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, body: init?.body });
      if (url.endsWith("/media")) {
        uploadCount += 1;
        return Response.json({ id: `media-${uploadCount}` });
      }
      return Response.json({ messages: [{ id: "message-1" }] });
    };

    const results = await sendBriefingWhatsApp(
      ["+62 812-3456-7890"],
      Buffer.from("briefing"),
      "30 Agustus 2026",
      Buffer.from("intelligence"),
    );

    assert.deepEqual(results, [{ recipient: "+62 812-3456-7890", success: true }]);
    assert.equal(calls.length, 4);
    assert.equal(calls.filter((call) => call.url.endsWith("/media")).length, 2);

    const messageBodies = calls
      .filter((call) => call.url.endsWith("/messages"))
      .map((call) => JSON.parse(String(call.body)) as {
        to: string;
        document: { id: string; filename: string };
      });

    assert.deepEqual(messageBodies.map((body) => body.to), [
      "6281234567890",
      "6281234567890",
    ]);
    assert.deepEqual(messageBodies.map((body) => body.document.id), [
      "media-1",
      "media-2",
    ]);
    assert.match(messageBodies[0]!.document.filename, /^Briefing-Harian-/);
    assert.match(messageBodies[1]!.document.filename, /^Laporan-Intelijen-/);
  });
});