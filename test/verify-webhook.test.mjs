import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhook } from "../src/webhook/verify-webhook.mjs";

const secret = "unit-test-secret-not-for-production";
const nowMs = 1_800_000_000_000;
const timestamp = String(Math.floor(nowMs / 1000));
const payload = Buffer.from(JSON.stringify({ event_id: "evt_123", type: "campaign.previewed" }));

function signature(body = payload, ts = timestamp, key = secret) {
  const digest = createHmac("sha256", key).update(ts).update(".").update(body).digest("hex");
  return `t=${ts},v1=${digest}`;
}
function args(overrides = {}) {
  return {
    rawBody: payload,
    signatureHeader: signature(),
    secret,
    nowMs,
    allowedEventTypes: ["campaign.previewed"],
    claimEvent: async () => true,
    ...overrides,
  };
}

test("accepts a valid signature and supported event", async () => {
  const result = await verifyWebhook(args());
  assert.equal(result.ok, true);
  assert.equal(result.eventId, "evt_123");
});

test("rejects an altered body", async () => {
  const result = await verifyWebhook(args({ rawBody: Buffer.from("{}") }));
  assert.equal(result.reason, "invalid_signature");
});

test("rejects a wrong secret", async () => {
  const result = await verifyWebhook(args({ signatureHeader: signature(payload, timestamp, "wrong") }));
  assert.equal(result.reason, "invalid_signature");
});

test("rejects stale timestamps", async () => {
  const oldTimestamp = String(Number(timestamp) - 1000);
  const result = await verifyWebhook(args({ signatureHeader: signature(payload, oldTimestamp) }));
  assert.equal(result.reason, "stale_timestamp");
});

test("rejects malformed and missing signatures", async () => {
  assert.equal((await verifyWebhook(args({ signatureHeader: "v1=bad" }))).reason, "malformed_signature");
  assert.equal((await verifyWebhook(args({ signatureHeader: undefined }))).reason, "missing_signature");
});

test("rejects unsupported event types before claiming event", async () => {
  const body = Buffer.from(JSON.stringify({ event_id: "evt_2", type: "unknown.event" }));
  let claimed = false;
  const result = await verifyWebhook(args({
    rawBody: body,
    signatureHeader: signature(body),
    claimEvent: async () => { claimed = true; return true; },
  }));
  assert.equal(result.reason, "unsupported_event_type");
  assert.equal(claimed, false);
});

test("rejects duplicate events", async () => {
  const result = await verifyWebhook(args({ claimEvent: async () => false }));
  assert.equal(result.reason, "duplicate_event");
});

test("fails closed if durable idempotency storage is unavailable", async () => {
  const result = await verifyWebhook(args({ claimEvent: async () => { throw new Error("offline"); } }));
  assert.equal(result.reason, "idempotency_store_unavailable");
});
