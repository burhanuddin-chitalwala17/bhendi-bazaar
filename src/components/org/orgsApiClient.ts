import { apiRequest } from "@/lib/api-client";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";

/** Creating an organisation from the org portal. */
export const orgsApiClient = {
  create: (data: OrgFormInput) => apiRequest<{ id: string }>("/api/orgs", { method: "POST", body: data }),
};
