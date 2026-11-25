import { apiRequest } from "@/lib/api-client";
import type { PostDraftDTO } from "@server/social/post.types";
import type { PostDraftInput, PostDraftSaveInput } from "@/lib/validation/schemas/post.schema";

/** The composer's calls (post-composer D3); autosave carries the version, and a 409 re-reads with `get`. */
export const postsApiClient = {
  create(orgId: string, body: PostDraftInput) {
    return apiRequest<{ post: PostDraftDTO }>(`/api/org/${orgId}/posts`, { method: "POST", body });
  },
  get(orgId: string, id: string) {
    return apiRequest<{ post: PostDraftDTO }>(`/api/org/${orgId}/posts/${id}`);
  },
  save(orgId: string, id: string, body: PostDraftSaveInput) {
    return apiRequest<{ post: PostDraftDTO }>(`/api/org/${orgId}/posts/${id}`, { method: "PUT", body });
  },
  duplicate(orgId: string, id: string) {
    return apiRequest<{ post: PostDraftDTO }>(`/api/org/${orgId}/posts/${id}/duplicate`, { method: "POST" });
  },
};
