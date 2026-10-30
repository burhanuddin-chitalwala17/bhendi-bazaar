import { CHANNEL_LABELS, type Channel } from "@server/shared/channels";
import { LISTING_PROBLEM, LISTING_READINESS } from "@server/listing/channel-readiness.types";
import type { ChannelVerdict } from "@server/listing/channel-readiness.service";
import { FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";
import { labelForFact, type ProductTypeRecord } from "@server/listing/product-type.types";

/** One place the shop sells on, and the questions it would still ask of this product. */
export interface ChannelHint {
  channel: Channel;
  label: string;
  /** The facts it asks that are unanswered, in this type's own words ("Fabric", not "material"). */
  asks: string[];
  ready: boolean;
}

/**
 * The hints a shop can act on in the form (product-form R5, Q8). Only an unanswered fact is
 * something to type; a missing mapping is the platform's work and is shown on the product page.
 */
export function hintsFrom(verdicts: readonly ChannelVerdict[], type: ProductTypeRecord | null): ChannelHint[] {
  return verdicts.map(({ channel, report }) => {
    const facts: FactKey[] = [];
    for (const problem of report.problems) {
      if (problem.problem !== LISTING_PROBLEM.MISSING_FACT && problem.problem !== LISTING_PROBLEM.MISSING_OPTIONAL_FACT) continue;
      if (!facts.includes(problem.fact)) facts.push(problem.fact);
    }
    const asks = facts.map((fact) => {
      const fallback = FACT_DECLARATIONS[fact]?.label ?? fact;
      return type ? labelForFact(type, fact, fallback) : fallback;
    });
    return { channel, label: CHANNEL_LABELS[channel], asks, ready: report.state === LISTING_READINESS.READY };
  });
}

/** "Amazon also asks: Fabric, Colour" (ux.md copy deck). */
export const alsoAsks = (hint: ChannelHint) => `${hint.label} also asks: ${hint.asks.join(", ")}`;
/** "Amazon will also ask: Fabric" (ux.md Review, Partial). */
export const willAlsoAsk = (hint: ChannelHint) => `${hint.label} will also ask: ${hint.asks.join(", ")}`;
