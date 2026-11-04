import { z } from "zod";
import { CENTRE, FILL_COLOUR, IMAGE_FIT } from "@server/catalog/image-slots";

/**
 * A slot's pictures as the field sends them (image-slots trd D4): a URL per form factor, how it is
 * framed, and the phone focus. The crop is fractions of the picture, so it survives the upload's
 * downscale; the server turns it into pixels of the stored file and checks it against the slot's
 * shape, which only it can do (`server/catalog/image-slot-write.ts`). Sizes the field measured are
 * stripped here: the asset's own are the ones that count.
 */

const unit = z.number().min(0).max(1);
/** A frame may round a hair past the edge; more than that is a frame outside the picture. */
const EDGE = 1e-3;

const frame = z
  .object({ x: unit, y: unit, width: unit.gt(0), height: unit.gt(0) })
  .refine((f) => f.x + f.width <= 1 + EDGE && f.y + f.height <= 1 + EDGE, "That frame falls outside the picture.");

const side = z
  .object({
    url: z.string().trim().min(1).max(2048),
    fit: z.enum([IMAGE_FIT.CROP, IMAGE_FIT.CONTAIN]),
    crop: frame.nullable().default(null),
    fill: z.string().regex(FILL_COLOUR, "Pick a fill colour.").nullable().default(null),
  })
  .refine((s) => s.fit !== IMAGE_FIT.CONTAIN || s.fill !== null, {
    message: "Fit it in needs a colour for the edges.",
    path: ["fill"],
  });

export const imageSlotInputSchema = z.object({
  desktop: side.nullable().default(null),
  phone: side.nullable().default(null),
  phoneFocus: z.object({ x: unit, y: unit }).default(CENTRE),
});

export type ImageSlotInput = z.infer<typeof imageSlotInputSchema>;
