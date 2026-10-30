import { apiRequest } from "@/lib/api-client";
import type { OpenShopInput } from "@/lib/validation/schemas/org.schema";

/** Opening a shop from the org portal. */
export const orgsApiClient = {
  create: (data: OpenShopInput) => apiRequest<{ id: string }>("/api/orgs", { method: "POST", body: data }),
};
