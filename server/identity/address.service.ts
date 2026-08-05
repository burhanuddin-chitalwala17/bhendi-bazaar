/**
 * Server-side Address Service
 *
 * This service encapsulates all business logic related to user addresses.
 * It acts as an intermediary between API routes and the repository layer.
 */

import { addressRepository } from "@server/identity/address.repository";
import type { DeliveryAddress } from "@server/identity/profile.types";
import { isValidPincode, PINCODE_MESSAGE } from "@server/shared/pincode";
import { DomainError, NotFoundError } from "@server/shared/domain-error";

export class AddressService {
  /**
   * Get all addresses for a user
   */
  async getAddressesByUserId(userId: string): Promise<DeliveryAddress[]> {
    const addresses = await addressRepository.getAddressesByUserId(userId);
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return [];
    } 
    return addresses as unknown as DeliveryAddress[];
  }

  /**
   * Get a single address by ID (with ownership check)
   */
  async getAddressById(
    userId: string,
    addressId: string
  ): Promise<DeliveryAddress | null> {
    const address = await addressRepository.getAddressById(userId, addressId);

    if (!address) {
      throw new NotFoundError("Address not found");
    }

    return address as unknown as DeliveryAddress;
  }

  /**
   * Add a new address
   */
  async addAddress(
    userId: string,
    input: DeliveryAddress
  ): Promise<boolean> {

    try {
    // Get existing addresses to check if this should be default
      const existingAddresses = await addressRepository.getAddressesByUserId(userId) as unknown as DeliveryAddress[];

    // Generate new ID
      const newAddress: DeliveryAddress = {
      ...input,
      // First address is automatically default
        metadata: {
          isDefault: input.metadata?.isDefault || existingAddresses.length === 0,
        },
    };

    // If setting as default, we need to unset others
      if (newAddress.metadata?.isDefault && existingAddresses.length > 0) {
      // Unset all other defaults
      const updatedExistingAddresses = existingAddresses.map((addr) => ({
        ...addr,
        metadata: {
          isDefault: false,
        },
      }));

      // Add new address
      const allAddresses = [...updatedExistingAddresses, newAddress];

      // Update all at once
      await addressRepository.updateAddresses(userId, allAddresses);
    } else {
      // Just add the new address
      await addressRepository.addAddress(userId, newAddress);
    }

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
    input: Partial<DeliveryAddress>
  ): Promise<boolean> {

    try {
    // Handle default flag separately
      if (input.metadata?.isDefault === true) {
      // If setting this as default, unset all others first
      const allAddresses = await addressRepository.getAddressesByUserId(userId) as unknown as DeliveryAddress[];
      const updatedAddresses = allAddresses.map((addr) => ({
        ...addr,
        metadata: {
          isDefault: addr.id === addressId,
        },
        // Apply updates if this is the target address
        ...(addr.id === addressId ? input : {}),
      }));

      await addressRepository.updateAddresses(userId, updatedAddresses);

      const updated = updatedAddresses.find((addr) => addr.id === addressId);
      if (!updated) throw new NotFoundError("Address not found");
      return true;
    }

    // Regular update
    const success = await addressRepository.updateAddress(userId, addressId, input);
    if (!success) {
      throw new Error("Failed to update address");
    }
    return true;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to update address");
    }
  }

  /**
   * Delete an address
   */
  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    try {

      // if only 1 address, then do not allow deletion
      const addresses = await addressRepository.getAddressesByUserId(userId) as unknown as DeliveryAddress[];
      if (addresses.length === 1) {
        throw new DomainError("Cannot delete the only address");
      }

    // Get the address to check if it's default
      const address = await addressRepository.getAddressById(userId, addressId) as unknown as DeliveryAddress;

    if (!address) {
      throw new NotFoundError("Address not found");
    }

    // Delete the address
    await addressRepository.deleteAddress(userId, addressId);

    // If deleted address was default, make the first remaining address default
      if (address.metadata?.isDefault) {
        await this.updateAddress(userId, addresses[0].id, { metadata: { isDefault: true } });

    }
    return true;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to delete address");
    }
  }


  /**
   * Validate address input
   */
  private validateAddressInput(
    input: DeliveryAddress,
    isPartial = false
  ): void {

    if (!isPartial || input.pincode) {
      if (!isValidPincode(input.pincode)) {
        throw new Error(PINCODE_MESSAGE);
      }
    }

    if (!isPartial || input.addressLine1) {
      if (!input.addressLine1 || input.addressLine1.trim().length < 5) {
        throw new DomainError("Address line 1 is required and must be at least 5 characters");
      }
    }
  }
}

// Export singleton instance
export const addressService = new AddressService();