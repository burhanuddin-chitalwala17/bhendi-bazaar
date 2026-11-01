/**
 * What a product's marketplace listing screens read (channel-listings, marketplace-publish). A read
 * that throws costs its block, not the page: the product page still opens.
 */

import { platformListingService } from "@server/channels/platform-listing.service";
import { listingPublishService } from "@server/channels/listing-publish.service";
import { listingCreateService } from "@server/channels/listing-create.service";
import type { ListingScreenDTO, ProductListingSummaryDTO, ReviewDTO } from "@server/channels/platform-listing.types";
import { NotFoundError } from "@server/shared/domain-error";

export const platformListingDAL = {
  /** The listing screen; null when the product has no listing on that marketplace. */
  async screen(orgId: string, productId: string, channel: string): Promise<ListingScreenDTO | null> {
    try {
      return await platformListingService.screen(orgId, productId, channel);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  },

  /** Each connected marketplace's status for the product's On marketplaces block. */
  async summaries(orgId: string, productId: string): Promise<ProductListingSummaryDTO[]> {
    try {
      return await platformListingService.summaries(orgId, productId);
    } catch (error) {
      console.error("[Product] listing summaries read failed:", error instanceof Error ? error.name : error);
      return [];
    }
  },

  /** Review and publish: every listing with changes on a marketplace, or one (marketplace-publish R1, R2). */
  async review(orgId: string, channel: string, listingId?: string): Promise<ReviewDTO | null> {
    try {
      return await listingPublishService.review(orgId, channel, listingId);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  },

  /** How many listings on a marketplace have changes waiting, for the Listings page bar. */
  async waitingCount(orgId: string, channel: string): Promise<number> {
    try {
      return (await listingPublishService.review(orgId, channel)).listings.length;
    } catch (error) {
      console.error("[Listings] waiting count read failed:", error instanceof Error ? error.name : error);
      return 0;
    }
  },

  /** What "Put on Amazon" opens with; null when the product or marketplace is not the shop's. */
  async createStart(orgId: string, productId: string, channel: string) {
    try {
      return await listingCreateService.startInfo(orgId, productId, channel);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  },
};
