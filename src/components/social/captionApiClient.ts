import { apiRequest } from "@/lib/api-client";
import type { CaptionDraftDto, CaptionPriceChangeDto } from "@server/content/caption.types";
import type { PostDraftDTO } from "@server/social/post.types";
import type { CaptionWriteInput } from "@/lib/validation/schemas/caption.schema";

/** The composer's caption calls (ai-images/social-posts journeys 4, 5). */
export const captionApiClient = {
  write(orgId: string, postId: string, body: CaptionWriteInput) {
    return apiRequest<{ draft: CaptionDraftDto }>(`/api/org/${orgId}/posts/${postId}/caption`, { method: "POST", body });
  },
  priceChanges(orgId: string, postId: string) {
    return apiRequest<{ changes: CaptionPriceChangeDto[] }>(`/api/org/${orgId}/posts/${postId}/caption/price`);
  },
  updatePrice(orgId: string, postId: string) {
    return apiRequest<{ post: PostDraftDTO; changes: CaptionPriceChangeDto[] }>(`/api/org/${orgId}/posts/${postId}/caption/price`, {
      method: "POST",
    });
  },
};
