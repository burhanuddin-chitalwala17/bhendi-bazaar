import { z } from "zod";
import { ENHANCEMENT_TOOL, STYLED_ASPECT, STYLED_ASPECTS, STYLED_BRIEF_MAX, STYLED_FACES } from "@server/content/enhancement.types";
import { SCENE_PRESET_KEYS } from "@server/content/scene-presets";
import { SHOT_ROLES } from "@server/catalog/shot-list";

const id = z.string().trim().min(1).max(64);

/**
 * One request for one improvement (image-enhancement spec R1, R2, R5). The photo is named by its
 * asset id or by the URL its gallery row carries — the editor knows only the URL — never both. The
 * slot and its role travel with it so the label slot is refused before a row exists (trd D8);
 * whether the photo is this org's and ready is the service's question, not the schema's.
 *
 * A photo that fills no slot sends `null`, not nothing: the editor knows it has no slot, which is
 * a different statement from having forgotten to say. Both are read as no slot.
 *
 * A setting is a key from the platform's own list and belongs to exactly one tool (spec R11): a
 * scene without one cannot be run, and anything else carrying one is describing a choice that tool
 * does not have. Both are refused here rather than shrugged off downstream, because a free-text
 * scene is the thing the fixed list exists to make impossible.
 */
export const requestEnhancementSchema = z
  .object({
    tool: z.enum(ENHANCEMENT_TOOL),
    preset: z.enum(SCENE_PRESET_KEYS).optional(),
    sourceAssetId: id.optional(),
    sourceRef: z.url().max(1024).optional(),
    slot: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .nullish()
      .transform((value) => value ?? undefined),
    slotRole: z
      .enum(SHOT_ROLES)
      .nullish()
      .transform((value) => value ?? undefined),
  })
  .refine((request) => (request.sourceAssetId ? 1 : 0) + (request.sourceRef ? 1 : 0) === 1, {
    message: "Name the photo by its asset id or its URL, not both",
    path: ["sourceAssetId"],
  })
  .refine((request) => request.tool !== ENHANCEMENT_TOOL.SCENE || request.preset !== undefined, {
    message: "Choose one of the scene settings",
    path: ["preset"],
  })
  .refine((request) => request.tool === ENHANCEMENT_TOOL.SCENE || request.preset === undefined, {
    message: "Only a scene has a setting to choose",
    path: ["preset"],
  });

export type RequestEnhancementBody = z.infer<typeof requestEnhancementSchema>;

/**
 * One AI picture (ai-images/improve-with-ai R3–R5, R9; D3): the photo as for the six tools, the
 * shop's description, pictures to follow by the URL each carries, and the face choice. How many
 * references a model takes is the server's question, not the schema's — the cap here is sanity.
 */
export const requestStyledSchema = z
  .object({
    sourceAssetId: id.optional(),
    sourceRef: z.url().max(1024).optional(),
    brief: z.string().trim().min(1, "Describe the picture first").max(STYLED_BRIEF_MAX, `Keep it under ${STYLED_BRIEF_MAX} characters`),
    referenceRefs: z.array(z.url().max(1024)).max(13).default([]),
    face: z.enum(STYLED_FACES),
    // The modal will not send without a shape (Q42); a page opened before that shipped sends none,
    // and gets what it always got: square.
    aspect: z.enum(STYLED_ASPECTS, "Choose the picture's shape").default(STYLED_ASPECT.SQUARE),
    previousId: id.nullish().transform((value) => value ?? undefined),
    slot: z.string().trim().min(1).max(40).nullish().transform((value) => value ?? undefined),
    slotRole: z.enum(SHOT_ROLES).nullish().transform((value) => value ?? undefined),
  })
  .refine((request) => (request.sourceAssetId ? 1 : 0) + (request.sourceRef ? 1 : 0) === 1, {
    message: "Name the photo by its asset id or its URL, not both",
    path: ["sourceAssetId"],
  });
export type RequestStyledBody = z.infer<typeof requestStyledSchema>;

/** How many pictures beyond the photo itself the quote is for. */
export const styledQuoteQuerySchema = z.object({
  references: z.coerce.number().int().min(0).max(13).catch(0),
  aspect: z.enum(STYLED_ASPECTS).catch(STYLED_ASPECT.SQUARE),
});

/** An allowance is a count of runs; the ceilings are sanity, not policy — the policy is the value. */
const allowance = z.number().int().positive().max(100_000);

/**
 * The platform's two numbers, as the admin form sends them (image-enhancement spec R7, trd D5).
 * The cap crosses in **paise** (Invariant 3) — the form shows rupees and converts before it sends,
 * so the wire carries the unit the column stores and no division happens on the way in.
 */
export const enhancementSettingsSchema = z.object({
  defaultMonthlyAllowance: allowance,
  dailyCapPaise: z.number().int().positive().max(10_000_000),
});
export type EnhancementSettingsInput = z.infer<typeof enhancementSettingsSchema>;

/**
 * What one org does differently (spec R7, A5): an allowance of its own, a pause, or neither. A
 * null allowance is not a missing field — it is the org saying it defers to the platform's number,
 * which is what lets its row be deleted rather than kept holding a copy.
 */
export const orgEnhancementPolicySchema = z.object({
  monthlyAllowance: allowance.nullable(),
  paused: z.boolean(),
  pauseReason: z.string().trim().min(1).max(200).nullable(),
});
export type OrgEnhancementPolicyInput = z.infer<typeof orgEnhancementPolicySchema>;
