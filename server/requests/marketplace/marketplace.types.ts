import { z } from "zod";

import type { Channel } from "@server/shared/channels";
import { TYPES_UNAVAILABLE } from "@server/channels/channel-connection.types";

import type { PlanBase, TicketSubject } from "../request.types";

/**
 * The marketplace plug-in's own words (setup-requests Q10, D6): the two requirement kinds a
 * marketplace raises, their subjects, previews and choices. The engine never imports this file.
 */
export const MARKETPLACE_KIND = {
  /** Fields a marketplace type requires that we neither ask nor fill. */
  FIELDS: "amazon-fields",
  /** Our product type has no marketplace type to publish to. */
  CATEGORY: "amazon-category",
} as const;

export interface FieldsSubject extends TicketSubject {
  kind: typeof MARKETPLACE_KIND.FIELDS;
  channel: Channel;
  theirCategory: string;
  attributes: string[];
}

export interface CategorySubject extends TicketSubject {
  kind: typeof MARKETPLACE_KIND.CATEGORY;
  channel: Channel;
  productType: string;
  productKind: string | null;
}

/** How one field is solved (D6, Q32). */
export const FIELD_SOLUTION = {
  REUSE: "reuse",
  ADD: "add",
  FROM_PRODUCT: "from_product",
  FIXED: "fixed",
  NOT_POSSIBLE: "not_possible",
} as const;
export type FieldSolution = (typeof FIELD_SOLUTION)[keyof typeof FIELD_SOLUTION];

export interface FieldsPlanDTO extends PlanBase {
  kind: typeof MARKETPLACE_KIND.FIELDS;
  theirCategory: string;
  productTypes: Array<{ key: string; label: string }>;
  fields: Array<{
    attribute: string;
    label: string;
    solution: FieldSolution;
    /** The fact reused or added, for reuse and add. */
    fact: string | null;
    factLabel: string | null;
    /** For from_product: sku, name or brand. For fixed: the value. */
    source: string | null;
    constant: string | null;
    /** The marketplace's allowed answers; values our list lacks are added under its wording. */
    allowed: string[];
    required: boolean;
  }>;
}

export interface CategoryPlanDTO extends PlanBase {
  kind: typeof MARKETPLACE_KIND.CATEGORY;
  productType: string;
  productTypeLabel: string;
  options: Array<{ theirCategory: string; label: string; exact: boolean }>;
}

export type MarketplacePlanDTO = FieldsPlanDTO | CategoryPlanDTO;

/** Why a marketplace preview could not be read: channels' own closed set (Q14). */
export const MARKETPLACE_UNAVAILABLE = TYPES_UNAVAILABLE;

/** What the admin may pick before Apply, parsed by the kind (Invariant 4). */
export const fieldsChoiceSchema = z.object({
  fields: z
    .array(
      z.object({
        attribute: z.string().min(1).max(120),
        solution: z.enum(Object.values(FIELD_SOLUTION) as [FieldSolution, ...FieldSolution[]]),
        fact: z.string().max(60).nullable().optional(),
        source: z.enum(["sku", "name", "brand"]).nullable().optional(),
        constant: z.string().max(200).nullable().optional(),
      }),
    )
    .max(100)
    .optional(),
});
export const categoryChoiceSchema = z.object({ theirCategory: z.string().trim().max(120).optional() });
