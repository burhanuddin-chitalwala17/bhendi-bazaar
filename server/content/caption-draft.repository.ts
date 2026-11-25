import { prisma } from "@server/shared/prisma";
import type { CaptionLanguage } from "@server/content/caption.types";
import type { StatedPrices } from "@server/content/caption/rules";

/** The one reader and writer of `CaptionDraft` (ADR-0003; ai-images/social-posts D4). */
export interface CaptionDraftRecord extends StatedPrices {
  factsHash: string;
  language: CaptionLanguage;
  generationId: string | null;
}

export const captionDraftRepository = {
  /** The post's stated prices, already merged with earlier drafts' by the caller (`mergeStated`). */
  async record(postId: string, draft: CaptionDraftRecord): Promise<void> {
    const data = { ...draft, createdAt: new Date() };
    await prisma.captionDraft.upsert({ where: { postId }, create: { postId, ...data }, update: data });
  },

  async find(postId: string): Promise<StatedPrices | null> {
    return await prisma.captionDraft.findUnique({
      where: { postId },
      select: { productIds: true, pricesPaise: true, effectivePricesPaise: true },
    });
  },

  /** After Update price is saved: the prices the caption now states. */
  async restate(postId: string, prices: StatedPrices): Promise<void> {
    await prisma.captionDraft.updateMany({ where: { postId }, data: prices });
  },
};
