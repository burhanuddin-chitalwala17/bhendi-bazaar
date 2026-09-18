import { readApiError } from "@/lib/api-error";
import type { GuestContactMessageFormValues } from "@/lib/validation/schemas/contact.schema";

/**
 * Email a Contact us message to the store. `email` is sent only by a guest; for a
 * signed-in sender the server uses the session's address (ADR-0013 for the error shape).
 */
export async function sendContactMessage(
  values: Pick<GuestContactMessageFormValues, "subject" | "message"> & { email?: string }
): Promise<void> {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  if (!response.ok) throw await readApiError(response);
}
