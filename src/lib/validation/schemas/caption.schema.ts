import { z } from "zod";

import { CAPTION_LANGUAGES } from "@server/content/caption.types";

/** Write a caption (ai-images/social-posts journey 4): the language only; the facts are the server's. */
export const captionWriteSchema = z.object({
  language: z.enum(CAPTION_LANGUAGES),
});
export type CaptionWriteInput = z.infer<typeof captionWriteSchema>;
