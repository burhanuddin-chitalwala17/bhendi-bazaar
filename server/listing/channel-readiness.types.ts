import type { FactKey } from "./listing-facts";

/**
 * Readiness's closed sets and verdict shape, free of Prisma so the product form can word a verdict
 * in the browser ([product-form](../../docs/specs/own-store/product-form/) D4). Decided in `channel-readiness.ts`.
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

export interface ListingReadinessReport {
  state: ListingReadiness;
  problems: readonly ListingProblem[];
  /** Where it would be listed, when that is settled — null while `NO_CATEGORY` is a problem. */
  theirCategory: string | null;
}
