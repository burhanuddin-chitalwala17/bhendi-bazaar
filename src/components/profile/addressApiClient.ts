import { apiRequest } from "@/lib/api-client";
import type { DeliveryAddress } from "@/domain/profile";

const BASE_URL = "/api/addresses";

/** The signed-in buyer's saved addresses. */
export const addressApiClient = {
  async getAddresses(): Promise<DeliveryAddress[]> {
    const data = await apiRequest<{ addresses: DeliveryAddress[] }>(BASE_URL);
    return data.addresses;
  },

  async addAddress(input: DeliveryAddress): Promise<boolean> {
    await apiRequest(BASE_URL, { method: "POST", body: input });
    return true;
  },

  async updateAddress(id: string, input: Partial<DeliveryAddress>): Promise<boolean> {
    await apiRequest(`${BASE_URL}/${id}`, { method: "PATCH", body: input });
    return true;
  },

  async deleteAddress(id: string): Promise<boolean> {
    await apiRequest(`${BASE_URL}/${id}`, { method: "DELETE" });
    return true;
  },
};
