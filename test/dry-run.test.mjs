import test from "node:test";
import assert from "node:assert/strict";
import { previewCampaignDispatch } from "../src/campaign/dry-run.mjs";

test("returns a preview without external side effects", () => {
  const receipt = previewCampaignDispatch({
    campaign_id: "campaign-test-1",
    status: "staged",
    channels: ["landing-page", "event-rsvp"],
  });
  assert.equal(receipt.mode, "dry_run");
  assert.equal(receipt.dispatched, false);
  assert.equal(receipt.externalSideEffects, false);
  assert.equal(receipt.next_action, "human_review_required");
});

test("rejects missing campaign identifiers", () => {
  assert.throws(() => previewCampaignDispatch({ status: "draft", channels: [] }), /campaign_id/);
});

test("rejects unapproved live-like states", () => {
  assert.throws(() => previewCampaignDispatch({
    campaign_id: "campaign-test-2",
    status: "dispatching",
    channels: ["email"],
  }), /not eligible/);
});
