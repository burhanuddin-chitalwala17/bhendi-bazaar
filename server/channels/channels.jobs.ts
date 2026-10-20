import { z } from "zod";
import { registerJob } from "@server/shared/jobs/jobs.registry";
import { registerSchedule } from "@server/shared/jobs/jobs.schedule";
import { adminOrgService } from "@server/catalog/org.service";

import { channelConnectionService } from "./channel-connection.service";

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
