import { apiRequest } from "@/lib/api-client";
import { ApiError } from "@/lib/api-error";
import type { GetShippingRatesRequest, GetShippingRatesResponse } from "@/domain/shipping";

export interface AllocateLine {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

/** One parcel as the server allocated it: a pickup location and the lines it ships. */
export interface AllocatedGroup {
  groupId: string;
  orgId: string;
  orgName: string;
  orgCode: string;
  locationName: string;
  fromPincode: string;
  fromCity: string;
  fromState: string;
  items: AllocateLine[];
  totalWeight: number;
  billableWeightKg: number;
}

export const shippingApiClient = {
  /** Which parcels the basket becomes (stock-locations R5/R10). */
  async allocate(items: AllocateLine[], destinationPincode: string): Promise<AllocatedGroup[]> {
    const data = await apiRequest<{ groups: AllocatedGroup[] }>("/api/checkout/allocate", {
      method: "POST",
      body: { items, destinationPincode },
    });
    return data.groups;
  },

  async getRates(request: GetShippingRatesRequest): Promise<GetShippingRatesResponse> {
    const { fromPincode, toPincode, weight, cod } = request;
    try {
      return await apiRequest<GetShippingRatesResponse>("/api/shipping/rates", {
        method: "POST",
        body: { fromPincode, toPincode, weight, cod },
      });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      throw new ApiError("Failed to fetch shipping rates", error.status, error.details);
    }
  },
};
