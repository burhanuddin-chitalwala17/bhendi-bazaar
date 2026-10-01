import { apiRequest } from "@/lib/api-client";
import type {
  BiddingFormInput,
  ConfirmSaleBody,
  MarkUnsoldBody,
  PlaceBidInputBody,
} from "@/lib/validation/schemas/bidding.schema";
import type { PublicBiddingView } from "@server/bidding/bidding.types";

/** What a placed bid hands back: the amounts and the count, never who leads (spec R16). */
export type BidStateView = Pick<
  PublicBiddingView,
  "highestBidPaise" | "bidCount" | "minBidPaise" | "maxBidPaise"
>;

/** Bidding events. `action` and `apiPath` are passed in because the org's route scopes them. */
export const biddingApiClient = {
  create: (action: string, data: BiddingFormInput) =>
    apiRequest<unknown>(action, { method: "POST", body: data }),

  cancel: (apiPath: string) => apiRequest(apiPath, { method: "DELETE" }),

  placeBid: (slug: string, data: PlaceBidInputBody) =>
    apiRequest<BidStateView>(`/api/bidding/${slug}/bids`, { method: "POST", body: data }),

  confirmSale: (eventId: string, data: ConfirmSaleBody) =>
    apiRequest(`/api/admin/bidding/${eventId}/sale`, { method: "POST", body: data }),

  markUnsold: (eventId: string, data: MarkUnsoldBody) =>
    apiRequest(`/api/admin/bidding/${eventId}/unsold`, { method: "POST", body: data }),
};
