/**
 * The fix page for one channel and one missing fact (readiness-fix R2, Q6): the products a channel
 * would refuse for want of it, each with its photo, the answers offered, and a marketplace's word.
 */

import { CHANNEL_LABELS, CHANNELS, type Channel } from "@server/shared/channels";
import { productService } from "@server/catalog/product.service";
import { channelReadinessService } from "@server/listing/channel-readiness.service";
import { readinessFixService } from "@server/listing/readiness-fix.service";
import { FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";
import type { FixPageDTO } from "@server/listing/readiness-fix.types";
import { channelFactsService } from "@server/channels/channel-facts.service";

export const readinessFixDAL = {
  async page(orgId: string, channel: string, fact: string): Promise<FixPageDTO | null> {
    if (!(CHANNELS as readonly string[]).includes(channel) || !FACT_DECLARATIONS[fact as FactKey]) return null;
    const ch = channel as Channel;
    const [{ missing: ids, rows: summary }, options] = await Promise.all([
      channelReadinessService.readinessOf(orgId, { channel: ch, fact: fact as FactKey }),
      readinessFixService.optionsFor(orgId, fact),
    ]);
    if (options.length === 0) return null;
    const [products, said] = await Promise.all([productService.forListing(orgId, ids), channelFactsService.saidFor(orgId, ids, fact)]);
    const row = summary.find((s) => s.channel === ch);
    return {
      channel: ch,
      channelLabel: CHANNEL_LABELS[ch],
      fact,
      factLabel: FACT_DECLARATIONS[fact as FactKey].label,
      options,
      rows: products
        .sort((a, b) => a.name.localeCompare(b.name, "en-IN"))
        .map((p) => ({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          photoUrl: p.media[0]?.ref ?? null,
          said: said[p.id] ? { channel: said[p.id].channel, label: CHANNEL_LABELS[said[p.id].channel as Channel] ?? said[p.id].channel, value: said[p.id].said } : null,
        })),
      wouldGo: row ? row.ready + row.warned : 0,
      total: row ? row.ready + row.warned + row.incomplete : 0,
    };
  },
};
