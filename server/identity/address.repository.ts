import { prisma } from "@server/shared/prisma";
import { addressRepository } from "@server/shared/address.repository";
import { NotFoundError } from "@server/shared/domain-error";
import type { DeliveryAddress } from "@server/identity/profile.types";

/**
 * A person's address book: `UserAddress` rows (this table's one writer, Invariant 5)
 * joined to the shared `Address` postal facts.
 *
 * The wire shape stays the flat `DeliveryAddress` the client always used (trd.md D4):
 * `id` is the UserAddress id, `mobile` maps to the `phone` column, and label/notes are
 * top-level — the old blob's `metadata` bag is gone.
 */

type UserAddressRow = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  address: {
    id: string;
    addressLine1: string;
    addressLine2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
};

const ROW_SELECT = {
  id: true,
  label: true,
  fullName: true,
  phone: true,
  email: true,
  notes: true,
  address: {
    select: {
      id: true,
      addressLine1: true,
      addressLine2: true,
      landmark: true,
      city: true,
      state: true,
      pincode: true,
      country: true,
    },
  },
} as const;

export function toDeliveryAddress(row: UserAddressRow): DeliveryAddress {
  return {
    id: row.id,
    fullName: row.fullName,
    mobile: row.phone,
    email: row.email ?? undefined,
    addressLine1: row.address.addressLine1,
    addressLine2: row.address.addressLine2 ?? undefined,
    landmark: row.address.landmark ?? undefined,
    city: row.address.city,
    state: row.address.state,
    pincode: row.address.pincode,
    country: row.address.country,
    label: row.label ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export class UserAddressRepository {
  async listByUserId(userId: string): Promise<DeliveryAddress[]> {
    const rows = await prisma.userAddress.findMany({
      where: { userId },
      select: ROW_SELECT,
      orderBy: { updatedAt: "desc" },
      relationLoadStrategy: "join",
    });
    return rows.map(toDeliveryAddress);
  }

  /** Ownership is the query: another user's id is simply not found. */
  async findOwned(userId: string, userAddressId: string): Promise<DeliveryAddress | null> {
    const row = await prisma.userAddress.findFirst({
      where: { id: userAddressId, userId },
      select: ROW_SELECT,
      relationLoadStrategy: "join",
    });
    return row ? toDeliveryAddress(row) : null;
  }

  async add(userId: string, input: Omit<DeliveryAddress, "id">): Promise<DeliveryAddress> {
    const address = await addressRepository.create(
      {
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        landmark: input.landmark,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        country: input.country,
      },
      userId
    );

    const row = await prisma.userAddress.create({
      data: {
        userId,
        addressId: address.id,
        label: input.label ?? null,
        fullName: input.fullName,
        phone: input.mobile,
        email: input.email ?? null,
        notes: input.notes ?? null,
      },
      select: ROW_SELECT,
    });
    return toDeliveryAddress(row);
  }

  async update(
    userId: string,
    userAddressId: string,
    input: Partial<Omit<DeliveryAddress, "id">>
  ): Promise<DeliveryAddress> {
    const owned = await prisma.userAddress.findFirst({
      where: { id: userAddressId, userId },
      select: { id: true, addressId: true },
    });
    if (!owned) throw new NotFoundError("Address not found");

    await addressRepository.update(owned.addressId, {
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      landmark: input.landmark,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      country: input.country,
    });

    const row = await prisma.userAddress.update({
      where: { id: owned.id },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.fullName !== undefined && { fullName: input.fullName }),
        ...(input.mobile !== undefined && { phone: input.mobile }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      select: ROW_SELECT,
    });
    return toDeliveryAddress(row);
  }

  /**
   * Removes the relationship; the postal row stays. Orders hold snapshots (D8) and a
   * future org may share the row, so deleting the fact is never the user's action.
   */
  async remove(userId: string, userAddressId: string): Promise<boolean> {
    const deleted = await prisma.userAddress.deleteMany({
      where: { id: userAddressId, userId },
    });
    return deleted.count === 1;
  }
}

export const userAddressRepository = new UserAddressRepository();
