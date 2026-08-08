import { prisma } from "@server/shared/prisma";

/**
 * The one writer of the `Address` table (Invariant 5). It lives in `shared` because
 * two domains' relationships point at postal facts — buyers' `UserAddress` today,
 * orgs' pickup locations when stock-locations lands — and one table gets one writer,
 * wherever both can reach it (addresses-as-entities D1).
 */
export interface PostalAddressInput {
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export class AddressRepository {
  async create(input: PostalAddressInput, createdBy?: string) {
    return prisma.address.create({
      data: {
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        landmark: input.landmark ?? null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        country: input.country ?? "India",
        createdBy: createdBy ?? null,
      },
    });
  }

  async update(id: string, input: Partial<PostalAddressInput>) {
    return prisma.address.update({
      where: { id },
      data: {
        ...(input.addressLine1 !== undefined && { addressLine1: input.addressLine1 }),
        ...(input.addressLine2 !== undefined && { addressLine2: input.addressLine2 }),
        ...(input.landmark !== undefined && { landmark: input.landmark }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.pincode !== undefined && { pincode: input.pincode }),
        ...(input.country !== undefined && { country: input.country }),
      },
    });
  }
}

export const addressRepository = new AddressRepository();
