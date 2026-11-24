import { z } from "zod";

/** Meta's deauthorize and data-deletion callbacks post one form field (meta-foundation D6, D7). */
export const metaSignedRequestSchema = z.object({
  signed_request: z.string().trim().min(10).max(8192),
});
