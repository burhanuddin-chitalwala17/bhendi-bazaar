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
import { pushStockSpec } from "@server/shared/jobs/push-stock.job";
import { channelStockService } from "./channel-stock.service";
import { channelOrdersService } from "./channel-orders.service";
import { checkOrdersSpec, checkStockSpec, ORDERS_CHECK_EVERY_SECONDS } from "./stock-checks.job";
import { enqueue, enqueueLater } from "@server/shared/jobs/jobs.enqueue";
import { prisma } from "@server/shared/prisma";

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
    // Stock sync's daily check, and a restart of the order check if its chain stopped (inventory-sync Q23).
    await enqueue(prisma, checkStockSpec, {});
    await enqueueLater(prisma, checkOrdersSpec, {}, { afterSeconds: 0, onePerSeconds: ORDERS_CHECK_EVERY_SECONDS });
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

/** A product's stock changed: its count goes to every marketplace with sync on (inventory-sync D2, D3). */
export const pushStockJob = registerJob({
  ...pushStockSpec,
  handler: async ({ jobId, payload }) => {
    const outcome = await channelStockService.push(payload.productId);
    if (outcome.sent > 0) console.log(`[jobs] channels.push-stock ${jobId}: ${JSON.stringify({ product: payload.productId, ...outcome })}`);
  },
});

/**
 * Sales and cancellations on each marketplace with stock sync on (inventory-sync D4). A run claims
 * the connections due, enqueues the next run before checking them, and stops when none was due (Q23).
 */
export const checkOrdersJob = registerJob({
  ...checkOrdersSpec,
  handler: async ({ jobId }) => {
    const checked = await channelOrdersService.checkDue(() =>
      enqueueLater(prisma, checkOrdersSpec, {}, { afterSeconds: ORDERS_CHECK_EVERY_SECONDS, onePerSeconds: ORDERS_CHECK_EVERY_SECONDS }),
    );
    if (checked > 0) console.log(`[jobs] channels.check-orders ${jobId}: ${checked} connections`);
  },
});

/** Every linked listing's count read and put back where it was changed by hand (inventory-sync D5). */
export const checkStockJob = registerJob({
  ...checkStockSpec,
  handler: async ({ jobId }) => {
    const checked = await channelStockService.dailyCheckAll();
    if (checked > 0) console.log(`[jobs] channels.check-stock ${jobId}: ${checked} connections`);
  },
});
