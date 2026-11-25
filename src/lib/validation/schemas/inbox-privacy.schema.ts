import { z } from "zod";

/** Share one chat with support for one of the shop's requests (inbox-core D9, ux step 9). */
export const supportShareSchema = z.object({
  requestId: z.string().min(1).max(64),
});
export type SupportShareInput = z.infer<typeof supportShareSchema>;
