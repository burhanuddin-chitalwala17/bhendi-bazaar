import { productService } from "@server/catalog/product.service";
import { postService } from "@server/social/post.service";
import { POST_DESTINATION_KIND, type PostDestinationKind } from "@server/social/post.types";
import { STYLED_ASPECT, type SocialPicturePresetsDto, type StyledAspect } from "@server/content/enhancement.types";

/** "Up to 3, the first product first" (ux journey 1); the shop can still add more up to the model's limit. */
export const SOCIAL_PRESET_REFERENCES = 3;

/** A feed post is portrait; a picture only for full-screen surfaces is tall (ux journey 1). */
export function socialAspectFor(destinations: readonly PostDestinationKind[]): StyledAspect | null {
  if (destinations.length === 0) return null;
  return destinations.includes(POST_DESTINATION_KIND.IG_FEED) ? STYLED_ASPECT.PORTRAIT : STYLED_ASPECT.TALL;
}

/**
 * What a post gives Improve with AI's window when it is opened from the composer (ai-images/social-posts
 * D1, R1). The request itself is Improve with AI's, with purpose `social`.
 */
export const socialPictureService = {
  async presets(orgId: string, postId: string): Promise<SocialPicturePresetsDto> {
    const post = await postService.get(orgId, postId);
    const referenceRefs: string[] = [];
    if (post.productIds.length > 0) {
      const photos = await productService.mainPhotos(orgId, post.productIds);
      for (const productId of post.productIds) {
        const ref = photos.get(productId)?.ref;
        if (ref && !referenceRefs.includes(ref)) referenceRefs.push(ref);
        if (referenceRefs.length === SOCIAL_PRESET_REFERENCES) break;
      }
    }
    return { aspect: socialAspectFor(post.destinations), referenceRefs };
  },
};
