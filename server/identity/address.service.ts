/**
 * A person's address book. Thin since PR-41: the blob surgery and the
 * default-juggling are gone — there is no default address by decision
 * (addresses-as-entities D3); the buyer picks at checkout.
 */

import { userAddressRepository } from "@server/identity/address.repository";
import { NotFoundError } from "@server/shared/domain-error";
import type { DeliveryAddress } from "@server/identity/profile.types";

export class AddressService {
  async getAddressesByUserId(userId: string): Promise<DeliveryAddress[]> {
    return userAddressRepository.listByUserId(userId);
  }

  async getAddressById(userId: string, userAddressId: string): Promise<DeliveryAddress> {
    const address = await userAddressRepository.findOwned(userId, userAddressId);
    if (!address) throw new NotFoundError("Address not found");
    return address;
  }

  async addAddress(
    userId: string,
    input: Omit<DeliveryAddress, "id">
  ): Promise<DeliveryAddress> {
    return userAddressRepository.add(userId, input);
  }

  async updateAddress(
    userId: string,
    userAddressId: string,
    input: Partial<Omit<DeliveryAddress, "id">>
  ): Promise<DeliveryAddress> {
    return userAddressRepository.update(userId, userAddressId, input);
  }

  async deleteAddress(userId: string, userAddressId: string): Promise<boolean> {
    const removed = await userAddressRepository.remove(userId, userAddressId);
    if (!removed) throw new NotFoundError("Address not found");
    return true;
  }
}

export const addressService = new AddressService();
