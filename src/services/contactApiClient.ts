import { readApiError } from "@/lib/api-error";
import type { ContactMessageFormValues } from "@/lib/validation/schemas/contact.schema";

/**
 * Send a Contact us message. Open to signed-out visitors, and the only write the
 * storefront makes into the support domain.
 *
 * Failures come back as an `ApiError` so `useServerForm` can put a field-attributed one
 * on its field ([ADR-0013](../../docs/adr/0013-one-error-envelope-and-useserverform.md)).
 */
export async function sendContactMessage(
  values: ContactMessageFormValues
): Promise<void> {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  if (!response.ok) throw await readApiError(response);
}
