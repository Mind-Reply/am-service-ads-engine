const ALLOWED_INITIAL_STATES = new Set(["draft", "needs_approval", "approved", "staged"]);

/**
 * Create a deterministic preview receipt only. This function deliberately has no
 * network, provider, billing, publishing, or hardware adapter.
 */
export function previewCampaignDispatch(campaign) {
  if (!campaign || typeof campaign !== "object" || Array.isArray(campaign)) {
    throw new TypeError("campaign must be an object");
  }
  if (typeof campaign.campaign_id !== "string" || !campaign.campaign_id.trim()) {
    throw new TypeError("campaign_id is required");
  }
  if (!ALLOWED_INITIAL_STATES.has(campaign.status)) {
    throw new Error("campaign status is not eligible for dry-run preview");
  }
  if (!Array.isArray(campaign.channels) || campaign.channels.some((x) => typeof x !== "string")) {
    throw new TypeError("channels must be an array of strings");
  }

  return Object.freeze({
    mode: "dry_run",
    dispatched: false,
    externalSideEffects: false,
    campaign_id: campaign.campaign_id,
    observed_at: new Date().toISOString(),
    planned_channels: [...campaign.channels],
    next_action: "human_review_required",
  });
}
