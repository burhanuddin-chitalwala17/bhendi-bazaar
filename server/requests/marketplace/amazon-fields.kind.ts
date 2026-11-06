import { CHANNEL_LABELS, isChannel, type Channel } from "@server/shared/channels";
import { channelTypesService } from "@server/channels/channel-types.service";
import { ATTRIBUTE_SOURCE, channelSetupService, isFactKey, type SetupField } from "@server/listing/channel-setup.service";
import { DomainError } from "@server/shared/domain-error";

import { TypesUnavailableError } from "@server/channels/channel-types.service";

import { REQUIREMENT_MODE, TICKET_TYPE, type TicketSubject } from "../request.types";
import { PlanUnavailableError, type TicketKindPlugin } from "../kinds/kind";
import { planHash, propose, valueKey } from "./field-match";
import { homeBrandOrgId } from "./home-brand";
import { FIELD_SOLUTION, MARKETPLACE_KIND, MARKETPLACE_UNAVAILABLE, fieldsChoiceSchema, type FieldsPlanDTO, type FieldsSubject } from "./marketplace.types";

const asFields = (s: TicketSubject) => s as FieldsSubject;

/** "Strap Type" from `strap_type`, for the shop before the definition is read. */
const titleCase = (name: string) => name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const typeWords = (theirCategory: string) => titleCase(theirCategory.toLowerCase());

/**
 * A field a marketplace type requires that we neither ask nor fill (setup-requests Q10, D6). Keyed by
 * the type alone, so every shop selling it joins one ticket; its attributes grow as shops hit more.
 */
export const amazonFieldsKind: TicketKindPlugin = {
  kind: MARKETPLACE_KIND.FIELDS,
  type: TICKET_TYPE.REQUIREMENT,
  mode: REQUIREMENT_MODE.ONE_TAP,
  keyOf: (s) => `${MARKETPLACE_KIND.FIELDS}:${asFields(s).channel}:${asFields(s).theirCategory}`,
  shopTitle: (s) => `${CHANNEL_LABELS[asFields(s).channel]} details for ${typeWords(asFields(s).theirCategory)}`,
  adminTitle: (s) => `${CHANNEL_LABELS[asFields(s).channel]} fields for ${asFields(s).theirCategory}`,
  names: (s) => asFields(s).attributes.map(titleCase),

  async plan(s) {
    const { channel, theirCategory, attributes } = asFields(s);
    const homeOrgId = homeBrandOrgId();
    if (!homeOrgId) throw new PlanUnavailableError(MARKETPLACE_UNAVAILABLE.NOT_CONNECTED);
    const [definition, vocabulary, answered] = await Promise.all([
      channelTypesService.definition(homeOrgId, channel, theirCategory).catch((error: unknown) => {
        if (error instanceof TypesUnavailableError) throw new PlanUnavailableError(error.reason);
        throw error;
      }),
      channelSetupService.vocabularyFor(channel, theirCategory),
      channelSetupService.answered(channel, theirCategory),
    ]);
    const asked = vocabulary.types.flatMap((t) => t.asked);
    const byName = new Map((definition?.attributes ?? []).map((a) => [a.name, a]));
    // What the shops hit, plus anything else the type requires and we do not answer: fixed once, not field by field.
    const wanted = [...new Set([...attributes, ...[...byName.keys()]])].filter((a) => !answered.has(a)).sort();
    const fields = wanted.map((name) => {
      const attribute = byName.get(name) ?? { name, label: titleCase(name), required: true, allowed: [] };
      const proposal = propose(attribute, asked, vocabulary.declared);
      const fact = proposal.fact ? (asked.find((f) => f.key === proposal.fact) ?? vocabulary.declared.find((f) => f.key === proposal.fact)) : null;
      return {
        attribute: name,
        label: attribute.label,
        ...proposal,
        factLabel: fact?.label ?? null,
        allowed: attribute.allowed,
        required: attribute.required,
      };
    });
    const readAt = new Date().toISOString();
    return {
      kind: MARKETPLACE_KIND.FIELDS,
      theirCategory,
      productTypes: vocabulary.types.map((t) => ({ key: t.key, label: t.label })),
      fields,
      readAt,
      hash: planHash({ fields: fields.map((f) => [f.attribute, f.solution, f.fact, f.source, f.constant, f.allowed]), types: vocabulary.types.map((t) => t.key) }),
    } satisfies FieldsPlanDTO;
  },

  async apply(tx, s, rawPlan, rawChoice, now) {
    // Fields need the marketplace's definition: without a preview there is nothing to apply (ux "not connected").
    if (!rawPlan) throw new DomainError("Couldn't reach Amazon. Try again.", { status: 503 });
    const plan = rawPlan as FieldsPlanDTO;
    const choice = fieldsChoiceSchema.parse(rawChoice);
    const { channel, theirCategory } = asFields(s);
    const chosen = new Map((choice.fields ?? []).map((f) => [f.attribute, f]));
    const vocabulary = await channelSetupService.vocabularyFor(channel, theirCategory);
    const asked = new Set(vocabulary.types.flatMap((t) => t.asked.map((f) => f.key)));
    const fields: SetupField[] = plan.fields.flatMap((field): SetupField[] => {
      const pick = { ...field, ...chosen.get(field.attribute) };
      if (pick.solution === FIELD_SOLUTION.FROM_PRODUCT) {
        const source = Object.values(ATTRIBUTE_SOURCE).find((v) => v === pick.source);
        if (!source) throw new DomainError(`Say which of the product's details fills ${field.attribute}.`, { field: "fields" });
        return [{ attribute: field.attribute, mode: "fill", source, constant: null }];
      }
      if (pick.solution === FIELD_SOLUTION.FIXED) return pick.constant ? [{ attribute: field.attribute, mode: "fill", source: null, constant: pick.constant }] : [];
      if ((pick.solution === FIELD_SOLUTION.REUSE || pick.solution === FIELD_SOLUTION.ADD) && pick.fact && isFactKey(pick.fact)) {
        const fact = vocabulary.declared.find((f) => f.key === pick.fact);
        const have = new Set((fact?.answers ?? []).map((a) => a.toLowerCase()));
        const newAnswers = field.allowed.filter((a) => !have.has(a.toLowerCase())).map((label) => ({ key: valueKey(label), label }));
        return [{ attribute: field.attribute, mode: "fact", fact: pick.fact, required: field.required, add: !asked.has(pick.fact), newAnswers: fact?.list ? newAnswers : [] }];
      }
      return [];
    });
    await channelSetupService.applyFields(tx, channel, theirCategory, fields, now);
  },

  async resolvedCheck(subjects) {
    const byChannel = new Map<Channel, string[]>();
    for (const s of subjects.map(asFields)) if (isChannel(s.channel)) byChannel.set(s.channel, [...(byChannel.get(s.channel) ?? []), s.theirCategory]);
    const answered = new Map<string, Set<string>>();
    for (const [channel, categories] of byChannel) {
      for (const [category, set] of await channelSetupService.answeredMany(channel, [...new Set(categories)])) answered.set(`${channel}:${category}`, set);
    }
    return (s) => {
      const f = asFields(s);
      const set = answered.get(`${f.channel}:${f.theirCategory}`);
      return !!set && f.attributes.every((a) => set.has(a));
    };
  },
};
