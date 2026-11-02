import { apiRequest } from "@/lib/api-client";
import type { ReadinessFixInput } from "@/lib/validation/schemas/platform-listing.schema";
import type { FixAnswerResultDTO } from "@server/listing/readiness-fix.types";

/** Answering a missing fact from a fix page (readiness-fix R3, R4). */
export const readinessFixApiClient = {
  answer(orgId: string, body: ReadinessFixInput) {
    return apiRequest<FixAnswerResultDTO>(`/api/org/${orgId}/products/facts`, { method: "PUT", body });
  },
  undo(orgId: string, body: ReadinessFixInput) {
    return apiRequest<{ undone: boolean }>(`/api/org/${orgId}/products/facts`, { method: "PUT", body: { ...body, undo: true } });
  },
};
