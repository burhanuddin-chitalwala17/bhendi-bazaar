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
import { stockChangedSpec } from "@server/shared/jobs/stock-changed.job";
import { channelStockService } from "./channel-stock.service";
import { channelOrdersService } from "./channel-orders.service";
import { platformListingService } from "./platform-listing.service";
import { listingPublishService } from "./listing-publish.service";
import { checkListingsSpec, enqueueListingCheck, publishListingSpec } from "./listing-publish.job";
import { checkListingProblemsSpec } from "./listing-problems.job";
import { channelCatalogueReader } from "./channel-catalogue.service";
import { MARKETPLACE_CHANNELS } from "./channel-connection.types";
import { requestsDailySpec } from "@server/shared/jobs/listing-complaints.job";
import { listingProblemsService } from "./listing-problems.service";
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
    // A listing linked by its SKU fills its product once, like one settled by hand (marketplace-facts Q36).
    await channelFactsService.fillUnread(payload.connectionId).catch((error: unknown) => {
      console.error(`[channels] facts fill not queued for ${payload.connectionId}: ${error instanceof Error ? error.name : "error"}`);
    });
    // Each newly linked listing gets its platform listing with what is live (channel-listings D3).
    await platformListingService.ensureForConnection(payload.connectionId).catch((error: unknown) => {
      console.error(`[channels] platform listings not made for ${payload.connectionId}: ${error instanceof Error ? error.name : "error"}`);
    });
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
    // Platform listings for anything linked since, and one more look at listings still waiting (marketplace-publish D5).
    await platformListingService.ensureForAll().catch((error: unknown) => console.error(`[channels] platform listings pass failed: ${error instanceof Error ? error.name : "error"}`));
    await listingPublishService.daily();
    // Each marketplace's own types and fields, read through the home brand (listing-model/channel-catalogue D2).
    // Every marketplace; one that publishes no definitions (Flipkart) reads nothing (D3).
    // Its counts are logged: a pass that read nothing looks healthy otherwise.
    for (const channel of MARKETPLACE_CHANNELS) {
      const r = await channelCatalogueReader.refresh(channel).catch((error: unknown) => {
        console.error(`[channels] catalogue refresh failed: ${error instanceof Error ? error.name : "error"}`);
        return null;
      });
      if (r) console.log(`[jobs] channels.maintain ${jobId}: catalogue ${channel} ${r.skipped ? `skipped (${r.skipped})` : `read ${r.read}, failed ${r.failed}, changed ${r.changes.length}`}`);
    }
    // What each marketplace says stops a listing now, for every shop in one run (marketplace-publish Q23).
    await enqueue(prisma, checkListingProblemsSpec, {});
    // Setup requests: close what is now set up, raise missing categories (setup-requests D9).
    await enqueue(prisma, requestsDailySpec, {});
    await channelFactsService.fillUnreadAll().catch((error: unknown) => console.error(`[channels] facts fill pass failed: ${error instanceof Error ? error.name : "error"}`));
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

/** A stock change, kept to the products a marketplace with sync on lists (inventory-sync Q27). */
export const stockChangedJob = registerJob({
  ...stockChangedSpec,
  handler: async ({ jobId, payload }) => {
    const queued = await channelStockService.pushChanged(payload.products);
    if (queued > 0) console.log(`[jobs] channels.stock-changed ${jobId}: ${queued} of ${payload.products.length} products to push`);
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

/** One listing's reviewed changes to its marketplace (marketplace-publish D3, D4). A busy marketplace throws, so the queue retries. */
export const publishListingJob = registerJob({
  ...publishListingSpec,
  handler: async ({ jobId, payload }) => {
    const outcome = await listingPublishService.send(payload.listingId);
    console.log(`[jobs] channels.publish-listing ${jobId}: ${JSON.stringify({ listing: payload.listingId, ...outcome })}`);
  },
});

/** The marketplaces' answers to what was sent (marketplace-publish D5, Q22): runs again when the next look falls due. */
export const checkListingsJob = registerJob({
  ...checkListingsSpec,
  handler: async ({ jobId }) => {
    const checked = await listingPublishService.checkDue((afterSeconds) =>
      enqueueListingCheck(prisma, afterSeconds),
    );
    if (checked > 0) console.log(`[jobs] channels.check-listings ${jobId}: ${checked} listings`);
  },
});

/** Every connected account's listings with errors, read once a day and recorded in one write (marketplace-publish Q23). */
export const checkListingProblemsJob = registerJob({
  ...checkListingProblemsSpec,
  handler: async ({ jobId }) => {
    const outcome = await listingProblemsService.checkAll();
    console.log(`[jobs] channels.check-listing-problems ${jobId}: ${JSON.stringify(outcome)}`);
  },
});
