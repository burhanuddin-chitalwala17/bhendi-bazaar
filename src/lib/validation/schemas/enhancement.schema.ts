import { z } from "zod";
import { ENHANCEMENT_TOOL } from "@server/content/enhancement.types";
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
 */
export const requestEnhancementSchema = z
  .object({
    tool: z.enum(ENHANCEMENT_TOOL),
    preset: z.string().trim().min(1).max(40).optional(),
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
  });

export type RequestEnhancementBody = z.infer<typeof requestEnhancementSchema>;
