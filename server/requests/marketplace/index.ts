import { CHANNEL, type Channel } from "@server/shared/channels";
import { channelTypesService } from "@server/channels/channel-types.service";
import { channelSetupService } from "@server/listing/channel-setup.service";
import { listingComplaintsPayload } from "@server/shared/jobs/listing-complaints.job";

import type { NeedInput } from "../request.types";
import type { NeedSource, TicketKindPlugin } from "../kinds/kind";
import { amazonCategoryKind } from "./amazon-category.kind";
import { amazonFieldsKind } from "./amazon-fields.kind";
import { needsFrom, type Complaint } from "./complaint-sort";
import { MARKETPLACE_KIND } from "./marketplace.types";

/**
 * The marketplace plug-in (setup-requests D4, D5): its kinds, and the needs it finds in a
 * marketplace's refusals and in categories with no marketplace type. The only part of `requests` that
 * reads channels or the channel register; the engine only sees `KINDS` and `NEED_SOURCES`.
 */
export const MARKETPLACE_KINDS: readonly TicketKindPlugin[] = [amazonFieldsKind, amazonCategoryKind];

/** Complaints, sorted into needs: one read of the products named, one per channel of what is set up (D5). */
async function fromComplaints(complaints: readonly Complaint[]): Promise<NeedInput[]> {
  if (complaints.length === 0) return [];
  const products = new Map((await channelSetupService.products([...new Set(complaints.map((c) => c.productId))])).map((p) => [p.id, p]));
  const known = complaints.filter((c) => products.get(c.productId)?.archivedAt === null);
  // A live listing's marketplace type is its product type's publishing one: one read per channel.
  const publishing = new Map<string, Awaited<ReturnType<typeof channelSetupService.publishing>>>();
  for (const channel of new Set(known.filter((c) => !c.theirCategory).map((c) => c.channel))) {
    const types = [...new Set(known.filter((c) => c.channel === channel).map((c) => products.get(c.productId)?.productType).filter((t): t is string => !!t))];
    publishing.set(channel, await channelSetupService.publishing(channel as Channel, types));
  }
  const live = known.map((c) => {
    if (c.theirCategory) return c;
    const p = products.get(c.productId)!;
    return { ...c, theirCategory: channelSetupService.publishingOf(publishing.get(c.channel) ?? [], p.productType, p.kind) };
  });
  const byChannel = new Map<string, string[]>();
  for (const c of live) if (c.theirCategory) byChannel.set(c.channel, [...(byChannel.get(c.channel) ?? []), c.theirCategory]);
  const answered = new Map<string, Set<string>>();
  for (const [channel, categories] of byChannel) {
    for (const [category, set] of await channelSetupService.answeredMany(channel as Channel, [...new Set(categories)])) answered.set(`${channel}:${category}`, set);
  }
  return needsFrom(live, (channel, category) => answered.get(`${channel}:${category}`) ?? new Set());
}

/** Types sold with no marketplace type to publish to (Q10): one read each side, Amazon only (it creates from here). */
async function missingCategories(): Promise<NeedInput[]> {
  const connected = (await channelTypesService.connectedOrgs()).filter((c) => c.channel === CHANNEL.AMAZON);
  if (connected.length === 0) return [];
  const channel = CHANNEL.AMAZON;
  const inUse = await channelSetupService.typesInUse(connected.map((c) => c.orgId));
  const publishing = new Set((await channelSetupService.publishing(channel, [...new Set(inUse.map((r) => r.productType))])).filter((r) => r.theirCategory).map((r) => r.productType));
  return inUse
    .filter((r) => !publishing.has(r.productType))
    .map((r) => ({ orgId: r.orgId, productId: null, subject: { kind: MARKETPLACE_KIND.CATEGORY, channel, productType: r.productType, productKind: null } }));
}

export const marketplaceNeeds: NeedSource = {
  name: "marketplace",
  async fromEvents(events) {
    const parsed = listingComplaintsPayload.shape.complaints.safeParse(events);
    return parsed.success ? await fromComplaints(parsed.data) : [];
  },
  daily: () => missingCategories(),
};

export { fromComplaints };
export { MARKETPLACE_KIND, FIELD_SOLUTION, MARKETPLACE_UNAVAILABLE, type MarketplacePlanDTO, type FieldsPlanDTO, type CategoryPlanDTO, type FieldSolution } from "./marketplace.types";
