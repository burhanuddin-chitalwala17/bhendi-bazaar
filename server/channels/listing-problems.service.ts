import { CHANNEL_LABELS } from "@server/shared/channels";

import { channelConnectionRepository } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelListingRepository } from "./channel-listing.repository";
import type { ListingIssue, ListingProblemsAttentionDTO } from "./platform-listing.types";
import { complaintIssues, handOverComplaints } from "./listing-complaints";
import { providerFor } from "./providers";

/** Accounts read at once: each has its own rate limit, so a few in parallel cost no one's (as inventory-sync Q26). */
const READ_CONCURRENCY = 4;

/**
 * What a marketplace says stops or limits a listing, found without a publish (marketplace-publish Q23):
 * a suppression a week after it went live surfaces with its reason and the same fix as a refused send.
 */
export const listingProblemsService = {
  /**
   * The daily look, for every shop in one run: one statement reads every connected account with its
   * token, each marketplace is asked once per account (Amazon filters to errors, twenty a page), and one
   * statement records every answer. An account that cannot be read keeps what it had.
   */
  async checkAll(now = new Date()): Promise<{ accounts: number; problems: number }> {
    const connections = (await channelConnectionRepository.connectedWithTokens()).filter((c) => isMarketplaceChannel(c.channel));
    const read: string[] = [];
    const found: Array<{ connectionId: string; sku: string; problems: unknown; suppressed: boolean }> = [];
    for (let i = 0; i < connections.length; i += READ_CONCURRENCY) {
      await Promise.all(
        connections.slice(i, i + READ_CONCURRENCY).map(async (c) => {
          try {
            const problems = await providerFor(c.channel as MarketplaceChannel).listingProblems(channelConnectionService.tokenSource(c), c.externalAccountId);
            for (const p of problems) found.push({ connectionId: c.id, sku: p.sku, problems: p.issues, suppressed: p.suppressed });
            read.push(c.id);
          } catch (error) {
            // Refused access is the daily maintain pass's to report; busy is tomorrow's look.
            console.error(`[channels] listing problems read failed for ${c.id}: ${error instanceof Error ? error.name : "error"}`);
          }
        }),
      );
    }
    const marked = await channelListingRepository.recordProblems(read, found, now);
    // The write names each listing's product; one job hands every shop's over (setup-requests D5, cost hazard).
    const linked = marked.flatMap((m) => (m.productId ? [{ ...m, productId: m.productId }] : []));
    const channelOf = new Map(connections.map((c) => [c.id, c.channel]));
    const issuesOf = new Map(found.map((f) => [`${f.connectionId}:${f.sku}`, f.problems as ListingIssue[]]));
    await handOverComplaints(linked.map((l) => ({ orgId: l.orgId, productId: l.productId, channel: channelOf.get(l.connectionId) ?? "", productType: null, kind: null, theirCategory: null, issues: complaintIssues(issuesOf.get(`${l.connectionId}:${l.sku}`) ?? []) })), { standing: true });
    return { accounts: read.length, problems: found.length };
  },

  /** Home's line (Q23): the marketplace with the most linked listings needing a fix. */
  async attention(orgId: string): Promise<ListingProblemsAttentionDTO | null> {
    const top = (await channelListingRepository.problemCounts(orgId)).filter((r) => isMarketplaceChannel(r.channel)).sort((a, b) => b.problems - a.problems)[0];
    if (!top) return null;
    const channel = top.channel as MarketplaceChannel;
    return { channel, label: CHANNEL_LABELS[channel], problems: top.problems, suppressed: top.suppressed };
  },
};
