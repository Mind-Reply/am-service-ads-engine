import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_MAX_SKEW_SECONDS = 300;
const DEFAULT_MAX_BODY_BYTES = 256 * 1024;

/**
 * Verify a webhook over the exact raw request bytes, then validate and claim its event ID.
 * claimEvent(eventId) must be backed by an atomic, durable uniqueness constraint in production.
 * No queue handoff occurs in this module.
 */
export async function verifyWebhook({
  rawBody,
  signatureHeader,
  secret,
  nowMs = Date.now(),
  maxSkewSeconds = DEFAULT_MAX_SKEW_SECONDS,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  allowedEventTypes = [],
  claimEvent,
}) {
  if (!Buffer.isBuffer(rawBody)) return reject("invalid_raw_body");
  if (!secret || typeof secret !== "string") return reject("missing_secret");
  if (rawBody.length > maxBodyBytes) return reject("body_too_large");
  if (typeof signatureHeader !== "string") return reject("missing_signature");
  if (typeof claimEvent !== "function") return reject("idempotency_store_unavailable");

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return reject("malformed_signature");

  const timestampMs = Number(parsed.timestamp) * 1000;
  if (!Number.isSafeInteger(Number(parsed.timestamp)) || !Number.isFinite(timestampMs)) {
    return reject("invalid_timestamp");
  }
  if (Math.abs(nowMs - timestampMs) > maxSkewSeconds * 1000) {
    return reject("stale_timestamp");
  }

  const expected = createHmac("sha256", secret)
    .update(parsed.timestamp, "utf8")
    .update(".", "utf8")
    .update(rawBody)
    .digest();

  let supplied;
  try {
    supplied = Buffer.from(parsed.signature, "hex");
  } catch {
    return reject("malformed_signature");
  }
  if (supplied.length !== expected.length || !/^[a-f0-9]{64}$/i.test(parsed.signature)) {
    return reject("invalid_signature");
  }
  if (!timingSafeEqual(expected, supplied)) return reject("invalid_signature");

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return reject("invalid_json");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return reject("invalid_payload");
  }
  if (typeof payload.event_id !== "string" || payload.event_id.trim().length === 0) {
    return reject("missing_event_id");
  }
  if (typeof payload.type !== "string" || !allowedEventTypes.includes(payload.type)) {
    return reject("unsupported_event_type");
  }

  let claimed;
  try {
    claimed = await claimEvent(payload.event_id);
  } catch {
    return reject("idempotency_store_unavailable");
  }
  if (claimed !== true) return reject("duplicate_event");

  return { ok: true, eventId: payload.event_id, payload };
}

function parseSignatureHeader(header) {
  // Strictly accept one timestamp and one v1 hex signature; reject duplicate fields.
  const parts = header.split(",").map((part) => part.trim());
  const timestamps = parts.filter((part) => part.startsWith("t="));
  const signatures = parts.filter((part) => part.startsWith("v1="));
  if (timestamps.length !== 1 || signatures.length !== 1 || parts.length !== 2) return null;
  const timestamp = timestamps[0].slice(2);
  const signature = signatures[0].slice(3);
  if (!/^\d{1,12}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return null;
  return { timestamp, signature };
}

function reject(reason) {
  return { ok: false, reason };
}
