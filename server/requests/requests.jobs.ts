import { registerJob } from "@server/shared/jobs/jobs.registry";
import { listingComplaintsSpec } from "@server/shared/jobs/listing-complaints.job";

import { requestService } from "./request.service";
import { requestsDailySpec, ticketResolvedSpec } from "./requests.job";
import { ticketRepository } from "./ticket.repository";

/** Complaints channels saw, raised as tickets in one batch (setup-requests D5). */
export const listingComplaintsJob = registerJob({
  ...listingComplaintsSpec,
  handler: async ({ jobId, payload }) => {
    // The engine reads no event: each source parses what it understands (setup-requests D4, D5).
    const raised = await requestService.raiseFromEvents(payload.complaints, new Date(), { reopen: !payload.standing });
    console.log(`[jobs] requests.listing-complaints ${jobId}: ${payload.complaints.length} complaints, ${raised} needs`);
  },
});

/** A resolved ticket's shops are told (D12): stamped now, shown on the bell once it exists (Q19). */
export const ticketResolvedJob = registerJob({
  ...ticketResolvedSpec,
  handler: async ({ jobId, payload }) => {
    const told = await ticketRepository.markNotified(payload.ticketId, new Date());
    console.log(`[jobs] requests.ticket-resolved ${jobId}: ${told} shops told`);
  },
});

/** Done is checked, not claimed (D9): enqueued by channels' daily maintain pass, so no schedule of its own. */
export const requestsDailyJob = registerJob({
  ...requestsDailySpec,
  handler: async ({ jobId }) => {
    const { resolved, raised, dropped } = await requestService.daily();
    console.log(`[jobs] requests.daily ${jobId}: ${dropped} needs left sale, ${resolved} resolved, ${raised} category needs raised`);
  },
});
