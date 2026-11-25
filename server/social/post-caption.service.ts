import { captionService } from "@server/content/caption.service";
import type { CaptionDraftDto, CaptionLanguage, CaptionPriceChangeDto } from "@server/content/caption.types";
import { postService } from "./post.service";
import type { PostDraftDTO } from "./post.types";

/**
 * A post's caption from content (ai-images/social-posts D3, D4): content drafts and checks the words,
 * social owns where they are saved. The composer saves a written caption itself; Update price saves here.
 */
export const postCaptionService = {
  async write(orgId: string, id: string, language: CaptionLanguage): Promise<CaptionDraftDto> {
    const post = await postService.get(orgId, id);
    return await captionService.write(orgId, { postId: post.id, productIds: post.productIds, language });
  },

  async priceChanges(orgId: string, id: string): Promise<CaptionPriceChangeDto[]> {
    const post = await postService.get(orgId, id);
    return await captionService.priceChanges(post.id, post.caption);
  },

  /** Update price (journey 5): saved at the version read, so an edit in between is a 409 and the composer re-reads. */
  async updatePrice(orgId: string, id: string): Promise<{ post: PostDraftDTO; changes: CaptionPriceChangeDto[] }> {
    const post = await postService.get(orgId, id);
    const { caption, changes } = await captionService.withLivePrices(post.id, post.caption);
    if (changes.length === 0) return { post, changes };
    const saved = await postService.saveDraft(orgId, post.id, {
      caption,
      mediaIds: post.mediaIds,
      productIds: post.productIds,
      destinations: post.destinations,
      version: post.version,
    });
    await captionService.restateWritten(post.id, changes);
    return { post: saved, changes };
  },
};
