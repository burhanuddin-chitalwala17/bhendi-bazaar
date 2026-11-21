import { apiRequest } from "@/lib/api-client";
import type { CommercialTermsInput } from "@/lib/validation/schemas/commercial-terms.schema";
import type { PaymentProofInput } from "./creditsApiClient";

/** What the handler accepts for a status change; `PAID` is terminal (org-payouts D8) and carries its proof (ai-images Q18). */
export type SettlementStatusChange =
  | ({ status: "PAID" } & PaymentProofInput)
  | { status: "CANCELLED" };

/** The platform's side of org payouts: commission terms and settlements. */
export const payoutsApiClient = {
  setCommercialTerms: (orgId: string, data: CommercialTermsInput) =>
    apiRequest(`/api/admin/orgs/${orgId}/commercial-terms`, { method: "PATCH", body: data }),

  createSettlement: (orgId: string, entryIds: string[]) =>
    apiRequest("/api/admin/settlements", { method: "POST", body: { orgId, entryIds } }),

  updateSettlement: (id: string, change: SettlementStatusChange) =>
    apiRequest(`/api/admin/settlements/${id}`, { method: "PATCH", body: change }),
};
