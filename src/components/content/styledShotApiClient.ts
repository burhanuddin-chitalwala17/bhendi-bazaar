import { apiRequest } from "@/lib/api-client";
import type {
  EnhancementDto,
  EnhancementUsage,
  RequestStyledInput,
  StyledAspect,
  StyledQuoteDto,
} from "@server/content/enhancement.types";

/** One AI picture's requests (ai-images/improve-with-ai D3, D4): its price, asking for it, and asking after it. */
export const styledShotApiClient = {
  quote(orgId: string, extraReferences: number, aspect: StyledAspect, signal?: AbortSignal) {
    const query = new URLSearchParams({ references: String(extraReferences), aspect });
    return apiRequest<StyledQuoteDto>(`/api/org/${orgId}/enhancements/styled/quote?${query}`, { signal });
  },

  request(orgId: string, input: RequestStyledInput) {
    return apiRequest<{ enhancement: EnhancementDto; usage: EnhancementUsage }>(`/api/org/${orgId}/enhancements/styled`, {
      method: "POST",
      body: input,
    });
  },

  get(orgId: string, id: string) {
    return apiRequest<{ enhancement: EnhancementDto }>(`/api/org/${orgId}/enhancements/${id}`);
  },
};
