import { z } from "zod";

/** The admin's switch for one paid feature (subscriptions/feature-access D12). The feature is the path. */
export const orgFeatureSwitchSchema = z.object({ enabled: z.boolean() }).strict();

export type OrgFeatureSwitchInput = z.infer<typeof orgFeatureSwitchSchema>;
