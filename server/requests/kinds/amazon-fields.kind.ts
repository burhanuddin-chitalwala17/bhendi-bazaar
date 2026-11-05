import { CHANNEL_LABELS, isChannel, type Channel } from "@server/shared/channels";
import { channelTypesService } from "@server/channels/channel-types.service";
import { ATTRIBUTE_SOURCE, channelSetupService, isFactKey, type SetupField } from "@server/listing/channel-setup.service";
import { DomainError } from "@server/shared/domain-error";

import { FIELD_SOLUTION, TICKET_KIND, TICKET_TYPE, type RequirementPlanDTO, type TicketSubject } from "../request.types";
import { planHash, propose, valueKey } from "./field-match";
import type { TicketKindPlugin } from "./kind";

type FieldsSubject = Extract<TicketSubject, { kind: typeof TICKET_KIND.AMAZON_FIELDS }>;
const asFields = (s: TicketSubject) => s as FieldsSubject;

/** "Strap Type" from `strap_type`, for the shop before the definition is read. */
const titleCase = (name: string) => name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const typeWords = (theirCategory: string) => titleCase(theirCategory.toLowerCase());

/**
 * A field a marketplace type requires that we neither ask nor fill (setup-requests Q10, D6). Keyed by
 * the type alone, so every shop selling it joins one ticket; its attributes grow as shops hit more.
 */
export const amazonFieldsKind: TicketKindPlugin = {
  kind: TICKET_KIND.AMAZON_FIELDS,
  type: TICKET_TYPE.REQUIREMENT,
  keyOf: (s) => `${TICKET_KIND.AMAZON_FIELDS}:${asFields(s).channel}:${asFields(s).theirCategory}`,
  shopTitle: (s) => `${CHANNEL_LABELS[asFields(s).channel]} details for ${typeWords(asFields(s).theirCategory)}`,
  adminTitle: (s) => `${CHANNEL_LABELS[asFields(s).channel]} fields for ${asFields(s).theirCategory}`,
  names: (s) => asFields(s).attributes.map(titleCase),

  async plan(s, homeOrgId) {
    const { channel, theirCategory, attributes } = asFields(s);
    if (!homeOrgId) throw new DomainError("No home brand is set to read marketplace types with.", { status: 409 });
    const [definition, vocabulary, answered] = await Promise.all([
      channelTypesService.definition(homeOrgId, channel, theirCategory),
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
      kind: TICKET_KIND.AMAZON_FIELDS,
      theirCategory,
      productTypes: vocabulary.types.map((t) => ({ key: t.key, label: t.label })),
      fields,
      readAt,
      hash: planHash({ fields: fields.map((f) => [f.attribute, f.solution, f.fact, f.source, f.constant, f.allowed]), types: vocabulary.types.map((t) => t.key) }),
    } satisfies RequirementPlanDTO;
  },

  async apply(tx, s, plan, choice, now) {
    if (plan.kind !== TICKET_KIND.AMAZON_FIELDS) return;
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
