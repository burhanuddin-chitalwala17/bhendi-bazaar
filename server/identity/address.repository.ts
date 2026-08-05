/**
 * Server-side Address Repository
 *
 * This repository handles all database operations for addresses.
 * Addresses are stored as JSON in the Profile table.
 */

import { prisma } from "@server/shared/prisma";
import type { DeliveryAddress } from "@server/identity/profile.types";
import { NotFoundError } from "@server/shared/domain-error";

export class AddressRepository {
  /**
   * Get all addresses for a user
   */
  async getAddressesByUserId(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { addresses: true },
    });

    if (!profile) {
      // Create profile if it doesn't exist
      const newProfile = await prisma.profile.create({
        data: {
          userId,
          addresses: [],
        },
      });
      return [];
    }

    return profile.addresses;
  }

  /**
   * Get a single address by ID (with ownership check)
   */
  async getAddressById(
    userId: string,
    addressId: string
  ) {
    const addresses = await this.getAddressesByUserId(userId);
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return null;
    }

    return addresses.find((addr: any) => addr.id === addressId) || null;
  }

  /**
   * Add a new address
   */
  async addAddress(
    userId: string,
    address: DeliveryAddress
  ) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { addresses: true },
    });

    try {
      if (!profile || !profile.addresses) {
        // Create profile with the new address
        await prisma.profile.create({
          data: {
            userId,
            addresses: [address] as any,
          },
        });
        return true;
      }

      const addresses = profile.addresses as unknown as DeliveryAddress[];
      const updatedAddresses = [...addresses, address];

      await prisma.profile.update({
        where: { userId },
        data: { addresses: updatedAddresses as any },
      });

      return true;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to add address");
    }
  }

  /**
   * Update an existing address
   */
  async updateAddress(
    userId: string,
    addressId: string,
    updates: Partial<DeliveryAddress>
  ) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { addresses: true },
    });

    if (!profile) {
      throw new NotFoundError("Profile not found");
    }

    const addresses = profile.addresses as unknown as DeliveryAddress[];
    const addressIndex = addresses.findIndex((addr) => addr.id === addressId);

    if (addressIndex === -1) {
      throw new NotFoundError("Address not found");
    }

    // Update the address
    const updatedAddress = { ...addresses[addressIndex], ...updates };
    addresses[addressIndex] = updatedAddress;

    await prisma.profile.update({
      where: { userId },
      data: { addresses: addresses as any },
    });

    return updatedAddress;
  }

  /**
   * Delete an address
   */
  async deleteAddress(userId: string, addressId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { addresses: true },
    });
  
    if (!profile) {
      throw new NotFoundError("Profile not found");
    }
  
    const addresses = profile.addresses as unknown as DeliveryAddress[];
    const addressExists = addresses.some(addr => addr.id === addressId);
  
    if (!addressExists) {
      throw new NotFoundError("Address not found");
    }
  
    // ✅ Immutable approach - cleaner
    const updatedAddresses = addresses.filter(addr => addr.id !== addressId);
  
    await prisma.profile.update({
      where: { userId },
      data: { addresses: updatedAddresses as any },
    });
  }

  /**
   * Update multiple addresses at once
   * Used for bulk operations like reordering or batch updates
   */
  async updateAddresses(
    userId: string,
    addresses: DeliveryAddress[]
  ) {
    await prisma.profile.update({
      where: { userId },
      data: { addresses: addresses as any },
    });

    return addresses;
  }
}

// Export singleton instance
export const addressRepository = new AddressRepository();