import { z } from "zod";

/** The shop's Amazon brand choice (setup-requests Q35): its own body, so the defaults form never resets it. */
export const amazonGenericSchema = z.object({ amazonGeneric: z.boolean() });
export type AmazonGenericInput = z.infer<typeof amazonGenericSchema>;
