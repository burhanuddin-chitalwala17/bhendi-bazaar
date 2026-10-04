import { ChannelMapFit } from "@prisma/client";

import { CHANNELS, isChannel, type Channel } from "@server/shared/channels";

import { answered } from "./fill-facts";
import { FACT_DECLARATIONS, ANSWER, type FactKey, type StoredFacts } from "./listing-facts";

/**
 * What each channel would make of a product, answered from stored data alone
 * ([channel-registry](../../docs/specs/channel-registry/) R6, D5).
 *
 * **It advises; it never gates** (D13). Nothing here refuses a publish, because nothing here has
 * ever watched one succeed — a refusal based on an untested idea of "required" would block
 * listings that would have gone through, and we would never learn which.
 *
 * Pure on purpose. The hard cases — a value mapping to nothing, a category that is only a
 * nearest fit, a channel whose required set changed — are unit tests here rather than an
 * account, a submission and a rejection three days later
 * ([ADR-0045](../../docs/adr/0045-channel-mappings-are-versioned-data.md) D4). It also means the
 * product page, the publish action and the admin register cannot disagree about what ready means.
 *
 * It answers about *mapping*, which is what this feature owns. Whether a photograph meets a
 * channel's shape is `server/content/channel-rules.ts`, and whether the shop itself is set up is
 * `org-onboarding.types.ts`; a caller showing a whole picture composes the three.
 */

/**
 * The three bands (D7). They are **advice, never permission** (D13): nothing here refuses a
 * publish, and the names say what we expect the channel to think rather than what we will do.
 *
 * Distinct from `READINESS_STATE` in `org-onboarding.types.ts`, which answers about the *shop* —
 * different questions with different answers, and one set stretched over both fits neither.
 */
export const LISTING_READINESS = {
  /** Something the channel calls required is absent, so we expect it to refuse. */
  INCOMPLETE: "incomplete",
  /** It would go, but not as well as it could, or not quite as itself. */
  WARNED: "warned",
  READY: "ready",
} as const;

export type ListingReadiness = (typeof LISTING_READINESS)[keyof typeof LISTING_READINESS];

export const LISTING_PROBLEM = {
  /** Nothing says which of their categories this type belongs in, so there is nowhere to send it. */
  NO_CATEGORY: "noCategory",
  /** Their nearest category rather than their word for the same thing (D6). */
  NEAREST_CATEGORY: "nearestCategory",
  /** They mark it compulsory, so we expect a listing without it to be refused. */
  MISSING_FACT: "missingFact",
  /** They ask for it and accept its absence. */
  MISSING_OPTIONAL_FACT: "missingOptionalFact",
  /** The product answers it, and nothing records their word for that answer (R5). */
  UNMAPPED_VALUE: "unmappedValue",
} as const;

export type ListingProblemKind = (typeof LISTING_PROBLEM)[keyof typeof LISTING_PROBLEM];

/**
 * How loudly each problem is said, declared once rather than decided at each site.
 *
 * A nearest fit is the quieter of the two deliberately: it is a listing that will go somewhere
 * defensible, and the point is that it is *seen* every time rather than that it is stopped
 * (spec R4, D6).
 */
const BAND: Readonly<Record<ListingProblemKind, Exclude<ListingReadiness, "ready">>> = {
  [LISTING_PROBLEM.NO_CATEGORY]: LISTING_READINESS.INCOMPLETE,
  [LISTING_PROBLEM.MISSING_FACT]: LISTING_READINESS.INCOMPLETE,
  [LISTING_PROBLEM.UNMAPPED_VALUE]: LISTING_READINESS.INCOMPLETE,
  [LISTING_PROBLEM.NEAREST_CATEGORY]: LISTING_READINESS.WARNED,
  [LISTING_PROBLEM.MISSING_OPTIONAL_FACT]: LISTING_READINESS.WARNED,
};

export type ListingProblem =
  | { problem: typeof LISTING_PROBLEM.NO_CATEGORY }
  | {
      problem: typeof LISTING_PROBLEM.NEAREST_CATEGORY;
      theirCategory: string;
      /** Why this is the nearest, as the platform recorded it. Shown with the fit. */
      note: string | null;
    }
  | {
      problem: typeof LISTING_PROBLEM.MISSING_FACT | typeof LISTING_PROBLEM.MISSING_OPTIONAL_FACT;
      fact: FactKey;
      /** Their word for it, so the shop reads the name it will see on their side. */
      theirAttribute: string;
    }
  | {
      problem: typeof LISTING_PROBLEM.UNMAPPED_VALUE;
      fact: FactKey;
      list: string;
      /** Our stored key, which is what the register's worklist is keyed on. */
      value: string;
    };

/** A category mapping, as much of it as deciding needs. */
export interface CategoryMapping {
  /** Null means every kind of the type; a row naming the kind wins over it. */
  kind: string | null;
  theirCategory: string;
  fit: ChannelMapFit;
  note: string | null;
}

export interface AttributeMapping {
  fact: FactKey;
  theirAttribute: string;
  required: boolean;
}

/**
 * One channel's half of the dictionary, for one product type.
 *
 * The categories are the type's whole set rather than one resolved row, because which applies
 * depends on the product's kind — so a register built once serves every product of that type,
 * which is what makes a listing screen a fixed number of queries instead of a few per row.
 *
 * Attributes are grouped by **their** category for the same reason they are stored that way: the
 * required-field set belongs to the channel's node, and two of our kinds can reach two nodes
 * that ask different things.
 */
export interface ChannelRegister {
  categories: readonly CategoryMapping[];
  attributesByCategory: ReadonlyMap<string, readonly AttributeMapping[]>;
  /** Their word exists for these of ours: list key → the value keys that are mapped. */
  mappedValues: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface ListingSubject {
  /** The product's kind, which may pick a different category than its type's catch-all. */
  kind: string | null;
  facts: StoredFacts;
}

export interface ListingReadinessReport {
  state: ListingReadiness;
  problems: readonly ListingProblem[];
  /** Where it would be listed, when that is settled — null while `NO_CATEGORY` is a problem. */
  theirCategory: string | null;
}

/**
 * The mapping that applies to a kind: the one naming it, else the type's catch-all.
 *
 * Specific beats general, so a type can map its kinds wholesale and still send the one kind that
 * belongs somewhere else to that somewhere else — which is how a rida gets its own node without
 * its type listing every other kind individually.
 */
export function categoryFor(
  rows: readonly CategoryMapping[],
  kind: string | null,
): CategoryMapping | null {
  if (kind !== null) {
    const named = rows.find((row) => row.kind === kind);
    if (named) return named;
  }
  return rows.find((row) => row.kind === null) ?? null;
}

/**
 * Every reason this product would not list cleanly on this channel, and the band they add up to.
 *
 * The loudest problem decides the band, and every problem is returned rather than the first — a
 * shop fixing one at a time, learning of the next only after saving, is the slow loop this whole
 * phase exists to shorten.
 *
 * A verdict is something to show, never something to act on: whether a listing is actually
 * accepted is the channel's answer, not ours (D13).
 */
export function listingReadiness(
  subject: ListingSubject,
  register: ChannelRegister,
): ListingReadinessReport {
  const problems: ListingProblem[] = [];
  const category = categoryFor(register.categories, subject.kind);

  if (category === null) {
    problems.push({ problem: LISTING_PROBLEM.NO_CATEGORY });
  } else if (category.fit === ChannelMapFit.NEAREST) {
    problems.push({
      problem: LISTING_PROBLEM.NEAREST_CATEGORY,
      theirCategory: category.theirCategory,
      note: category.note,
    });
  }

  // Whatever their node asks. No category resolved means no node, so there is nothing it asks.
  const attributes =
    category === null ? [] : (register.attributesByCategory.get(category.theirCategory) ?? []);

  for (const attribute of attributes) {
    const stored = subject.facts[attribute.fact];

    if (!stored || !answered(stored.value)) {
      problems.push({
        problem: attribute.required
          ? LISTING_PROBLEM.MISSING_FACT
          : LISTING_PROBLEM.MISSING_OPTIONAL_FACT,
        fact: attribute.fact,
        theirAttribute: attribute.theirAttribute,
      });
      continue;
    }

    const list = listOf(attribute.fact);
    if (list === null) continue;

    // An unlisted answer is one the shop typed because no permitted value fitted (categories D8).
    // It cannot have a mapping, because there is nothing on our side for a mapping to point at.
    const value = String(stored.value);
    if (stored.unlisted || !register.mappedValues.get(list)?.has(value)) {
      problems.push({ problem: LISTING_PROBLEM.UNMAPPED_VALUE, fact: attribute.fact, list, value });
    }
  }

  return {
    state: worst(problems),
    problems,
    theirCategory: category?.theirCategory ?? null,
  };
}

/** The list a fact draws its answers from, or null where the answer is free. */
function listOf(fact: FactKey): string | null {
  const declaration = FACT_DECLARATIONS[fact];
  if (!declaration || declaration.answer !== ANSWER.CHOICE) return null;
  return declaration.list ?? null;
}

function worst(problems: readonly ListingProblem[]): ListingReadiness {
  if (problems.some((entry) => BAND[entry.problem] === LISTING_READINESS.INCOMPLETE)) {
    return LISTING_READINESS.INCOMPLETE;
  }
  return problems.length > 0 ? LISTING_READINESS.WARNED : LISTING_READINESS.READY;
}

/**
 * The values this channel has no word for, across a set of products — the register's worklist.
 *
 * Keyed by list and value rather than by product, because that is the shape of the work: one
 * mapping added for "maroon" clears it for every product that answers maroon, and a worklist
 * that repeated it per product would make a finite job look endless (spec A3, fourth hazard).
 */
export function unmappedValues(
  reports: readonly ListingReadinessReport[],
): { list: string; value: string; facts: FactKey[]; products: number }[] {
  const found = new Map<string, { list: string; value: string; facts: Set<FactKey>; products: number }>();

  for (const report of reports) {
    const seen = new Set<string>();
    for (const problem of report.problems) {
      if (problem.problem !== LISTING_PROBLEM.UNMAPPED_VALUE) continue;
      const id = `${problem.list}\u0000${problem.value}`;
      const entry = found.get(id) ?? {
        list: problem.list,
        value: problem.value,
        facts: new Set<FactKey>(),
        products: 0,
      };
      entry.facts.add(problem.fact);
      // One product answering the same unmapped value for two facts is one product to fix.
      if (!seen.has(id)) {
        entry.products += 1;
        seen.add(id);
      }
      found.set(id, entry);
    }
  }

  return [...found.values()]
    .map((entry) => ({ ...entry, facts: [...entry.facts].sort() }))
    .sort((a, b) => b.products - a.products || a.list.localeCompare(b.list) || a.value.localeCompare(b.value));
}

/**
 * The channels a shop has said it sells on, in the order they are shown.
 *
 * An absent row is off, so a shop that has decided nothing is asked for nothing and warned about
 * nothing (D2, spec A6). A stored key that is no longer a declared channel is dropped rather
 * than carried: `instagram` was in the set until `meta` replaced it, and a row surviving a
 * rename must not quietly re-enable a channel nothing can publish to.
 */
export function enabledChannels(
  rows: readonly { channel: string; enabled: boolean }[],
): Channel[] {
  const on = new Set(rows.filter((row) => row.enabled).map((row) => row.channel));
  return CHANNELS.filter((channel) => on.has(channel) && isChannel(channel));
}

/**
 * Readiness for each channel a shop sells on, in display order.
 *
 * The map holds only the channels being asked about, so a shop that has enabled none gets an
 * empty answer rather than a page of warnings about places it does not sell (spec A6).
 */
export function readinessByChannel(
  subject: ListingSubject,
  registers: ReadonlyMap<Channel, ChannelRegister>,
): { channel: Channel; report: ListingReadinessReport }[] {
  return CHANNELS.filter((channel) => registers.has(channel)).map((channel) => ({
    channel,
    report: listingReadiness(subject, registers.get(channel)!),
  }));
}
