/**
 * Client-side Address Service
 *
 * This service handles all address-related API calls from the client side.
 * UI components should use this service instead of making direct fetch calls.
 */

import type { DeliveryAddress } from "@/domain/profile";

class AddressService {
    private baseUrl = "/api/addresses";

    /**
     * Fetch all addresses for the authenticated user
     */
    async getAddresses(): Promise<DeliveryAddress[]> {
        const response = await fetch(this.baseUrl, {
            credentials: "include",
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to fetch addresses");
        }

        const data = await response.json();
        return data.addresses;
    }


    /**
     * Add a new address
     */
    async addAddress(input: DeliveryAddress): Promise<boolean> {
        const response = await fetch(this.baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to add address");
        }

        return true;
    }

    /**
     * Update an existing address
     */
    async updateAddress(id: string, input: Partial<DeliveryAddress>): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify(input),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update address");
            }
            return true;
        } catch (error) {
            throw new Error(error instanceof Error ? error.message : "Failed to update address");
        }
    }

    /**
     * Delete an address
     */
    async deleteAddress(id: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/${id}`, {
                method: "DELETE",
                credentials: "include",
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to delete address");
            }
            return true;
        } catch (error) {
            throw new Error(error instanceof Error ? error.message : "Failed to delete address");
        }
    }

}

// Export singleton instance
export const addressApiClient = new AddressService();