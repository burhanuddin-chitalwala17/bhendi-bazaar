import { z } from "zod";
import { registerJob } from "@server/shared/jobs/jobs.registry";
import { registerSchedule } from "@server/shared/jobs/jobs.schedule";
import { adminOrgService } from "@server/catalog/org.service";

import { channelConnectionService } from "./channel-connection.service";
import { channelImportService } from "./channel-import.service";
import { listingReadSpec } from "./listing-read.job";
import { channelSettleService } from "./channel-settle.service";
import { listingPhotosSpec } from "./listing-photos.job";
import { channelFactsService } from "./channel-facts.service";
import { listingFactsSpec } from "./listing-facts.job";

/**
 * A shop's listing read (channel-import D3): one per connection at a time, claimed inside the
 * service. A busy marketplace throws, so the queue's retries resume it; rows already read stay.
 */
export const listingReadJob = registerJob({
  ...listingReadSpec,
  handler: async ({ jobId, payload }) => {
    const outcome = await channelImportService.runRead(payload.connectionId);
    console.log(`[jobs] channels.read-listings ${jobId}: ${JSON.stringify({ connection: payload.connectionId, ...outcome })}`);
  },
});

/** Once a day (channel-connectors D7): connections change on a scale of days, not minutes. */
export const CHANNELS_MAINTAIN_INTERVAL_SECONDS = 86_400;

/**
 * Keeps every live marketplace connection healthy without anyone visiting the page: one cheap read
 * behind "Last checked", Flipkart's refresh token renewed before its 180 days run out (hazard 2),
 * and tokens re-sealed under the current key after a key is added. Suspended shops are skipped
 * (decision Q11). Every run reports, including the quiet ones.
 */
export const channelsMaintainJob = registerJob({
  type: "channels.maintain",
  schema: z.object({}),
  handler: async ({ jobId }) => {
    const summary = await channelConnectionService.maintain(async (orgId) => {
      try {
        return (await adminOrgService.getOrg(orgId)).isBlocked === true;
      } catch {
        return true;
      }
    });
    console.log(
      `[jobs] channels.maintain ${jobId}: checked ${summary.checked}, renewed ${summary.renewed}, ` +
        `resealed ${summary.resealed}, needs reconnect ${summary.needsReconnect}, ` +
        `unreachable ${summary.unreachable}, skipped ${summary.skipped}`,
    );
  },
});

registerSchedule(channelsMaintainJob, {}, CHANNELS_MAINTAIN_INTERVAL_SECONDS);

/** A settled listing's photos onto its product (product-merge D6). A photo that fails is counted, not retried here. */
export const listingPhotosJob = registerJob({
  ...listingPhotosSpec,
  handler: async ({ jobId, payload }) => {
    const outcome = await channelSettleService.copyPhotos(payload);
    console.log(`[jobs] channels.copy-listing-photos ${jobId}: ${JSON.stringify({ listing: payload.listingId, ...outcome })}`);
  },
});

/** A linked listing's facts onto its product (marketplace-facts D7): only what is still empty. */
export const listingFactsJob = registerJob({
  ...listingFactsSpec,
  handler: async ({ jobId, payload }) => {
    const outcome = await channelFactsService.run(payload);
    console.log(`[jobs] channels.fill-facts ${jobId}: ${JSON.stringify({ listing: payload.listingId, ...outcome })}`);
  },
});
