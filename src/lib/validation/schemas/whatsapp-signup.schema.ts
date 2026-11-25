import { z } from "zod";

import { WHATSAPP_NUMBER_KIND } from "@server/channels/channel-connection.types";

/** Meta's ids are numeric strings; anything else never reaches a Graph path. */
const META_ID = z.string().regex(/^\d{1,30}$/);

/**
 * What the page posts back from Meta's Embedded Signup pop-up (connect-whatsapp D1). Every field is
 * untrusted: the state is verified and spent, the code exchanged, and the ids confirmed with Meta.
 */
export const whatsappSignupSchema = z.object({
  state: z.string().min(1).max(4096),
  code: z.string().min(1).max(2048),
  businessId: META_ID,
  phoneId: META_ID,
  kind: z.enum([WHATSAPP_NUMBER_KIND.COEXISTENCE, WHATSAPP_NUMBER_KIND.CLOUD]),
});
export type WhatsAppSignupInput = z.infer<typeof whatsappSignupSchema>;
