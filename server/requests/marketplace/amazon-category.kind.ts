import { CHANNEL_LABELS, isChannel, type Channel } from "@server/shared/channels";
import { channelTypesService } from "@server/channels/channel-types.service";
import { channelSetupService } from "@server/listing/channel-setup.service";
import { DomainError } from "@server/shared/domain-error";

import { TypesUnavailableError } from "@server/channels/channel-types.service";

import { REQUIREMENT_MODE, TICKET_TYPE, type TicketSubject } from "../request.types";
import { PlanUnavailableError, type TicketKindPlugin } from "../kinds/kind";
import { planHash, words } from "./field-match";
import { homeBrandOrgId } from "@server/shared/home-brand";
import { MARKETPLACE_KIND, MARKETPLACE_UNAVAILABLE, categoryChoiceSchema, type CategoryPlanDTO, type CategorySubject } from "./marketplace.types";

const asCategory = (s: TicketSubject) => s as CategorySubject;

/** Options shown for a decision (ux): Amazon's closest five. */
const OPTIONS_MAX = 5;

/**
 * Our product type has no marketplace type to publish to (setup-requests Q10). A decision kind (Q6):
 * the admin picks one of the marketplace's matching types; none is picked unless its name matches
 * ours exactly (Q29).
 */
export const amazonCategoryKind: TicketKindPlugin = {
  kind: MARKETPLACE_KIND.CATEGORY,
  type: TICKET_TYPE.REQUIREMENT,
  mode: REQUIREMENT_MODE.DECISION,
  keyOf: (s) => `${MARKETPLACE_KIND.CATEGORY}:${asCategory(s).channel}:${asCategory(s).productType}`,
  shopTitle: (s) => `${CHANNEL_LABELS[asCategory(s).channel]} category for ${asCategory(s).productType}`,
  adminTitle: (s) => `${CHANNEL_LABELS[asCategory(s).channel]} category for ${asCategory(s).productType}`,
  names: () => [],

  async plan(s) {
    const { channel, productType } = asCategory(s);
    const homeOrgId = homeBrandOrgId();
    if (!homeOrgId) throw new PlanUnavailableError(MARKETPLACE_UNAVAILABLE.NOT_CONNECTED);
    const label = await channelSetupService.typeLabel(productType);
    const found = await channelTypesService.search(homeOrgId, channel, label).catch((error: unknown) => {
      if (error instanceof TypesUnavailableError) throw new PlanUnavailableError(error.reason);
      throw error;
    });
    const ours = words(label).join(" ");
    const options = found.slice(0, OPTIONS_MAX).map((t) => ({ ...t, exact: words(t.theirCategory).join(" ") === ours || words(t.label).join(" ") === ours }));
    return {
      kind: MARKETPLACE_KIND.CATEGORY,
      productType,
      productTypeLabel: label,
      options,
      readAt: new Date().toISOString(),
      hash: planHash({ productType, options: options.map((o) => o.theirCategory) }),
    } satisfies CategoryPlanDTO;
  },

  // A decision applies by hand too: a type the admin typed needs no preview (ux "not connected").
  async apply(tx, s, rawPlan, rawChoice, now) {
    const plan = rawPlan as CategoryPlanDTO | null;
    const choice = categoryChoiceSchema.parse(rawChoice);
    const { channel, productType } = asCategory(s);
    const picked = choice.theirCategory?.trim().toUpperCase().replace(/[ -]+/g, "_");
    if (!picked) throw new DomainError("Pick one of Amazon's types first.", { status: 400, field: "theirCategory" });
    const option = plan?.options.find((o) => o.theirCategory === picked);
    await channelSetupService.applyCategory(tx, channel, productType, picked, option?.label ?? picked, now);
  },

  async resolvedCheck(subjects) {
    const byChannel = new Map<Channel, string[]>();
    for (const s of subjects.map(asCategory)) if (isChannel(s.channel)) byChannel.set(s.channel, [...(byChannel.get(s.channel) ?? []), s.productType]);
    const publishing = new Set<string>();
    for (const [channel, types] of byChannel) {
      for (const row of await channelSetupService.publishing(channel, [...new Set(types)])) if (row.theirCategory) publishing.add(`${channel}:${row.productType}`);
    }
    return (s) => publishing.has(`${asCategory(s).channel}:${asCategory(s).productType}`);
  },
};
