# am-service-ads-engine

AM Service Ads & SMS Engine — nationwide campaign orchestration foundations for MindReply and related operations.

## HighStrike core status

The initial implementation is **dry-run only**. It provides:
- strict HMAC-SHA-256 webhook verification over raw request bytes, timing-safe signature comparison, timestamp freshness, event-type validation, and an idempotency-store interface;
- a deterministic campaign preview receipt that explicitly records that nothing was dispatched;
- Node's built-in test suite and a GitHub Actions workflow.

## Security and production limits

- Never commit webhook secrets. Supply secrets through an approved runtime secret manager.
- The production adapter for `claimEvent(eventId)` must use a durable, atomic uniqueness constraint. The included tests use in-memory callbacks only.
- This repository does not yet implement a queue, provider integrations, WORM/object-lock storage, operator notifications, RSVP/telemetry collection, Stripe checkout, or live dispatch.
- A valid signature alone is not authorization to publish, contact recipients, charge money, or actuate hardware.
- Production activation requires privacy/security review, provider sandbox tests, operator escalation verification, bounded audience/budget, explicit owner approval, and a rollback/stop plan.

## Local verification

Requires Node.js 20 or newer.

```sh
npm run check
npm test
```
