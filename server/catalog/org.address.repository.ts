import { prisma } from "@server/shared/prisma";
import { addressRepository } from "@server/shared/address.repository";

/**
 * Pickup locations — the only place `prisma.orgAddress` is touched (ADR-0003).
 * The postal fact itself is written through the shared Address writer, same as the
 * customer address book. Wire shape is flat, like DeliveryAddress: the id is the
 * OrgAddress (relationship) id, the postal fields come from the joined Address.
 */

export interface OrgLocation {
  id: string;
  name: string;
  contactName: string;
  contactPhone: string;
  isActive: boolean;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  /** Products with units physically here — what blocks deletion (R8). */
  stockedProducts: number;
  /** Parcels that name this location as their origin — also blocks deletion (R8). */
  shipmentCount: number;
}

export interface OrgLocationWrite {
  name: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isActive?: boolean;
}

const ROW_INCLUDE = {
  address: true,
  _count: {
    select: {
      productStock: { where: { quantity: { gt: 0 } } },
      shipments: true,
    },
  },
} as const;

interface LocationRow {
  id: string;
  name: string;
  contactName: string;
  contactPhone: string;
  isActive: boolean;
  address: {
    addressLine1: string;
    addressLine2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  _count: { productStock: number; shipments: number };
}

/** Exported for tests. */
export function toOrgLocation(row: LocationRow): OrgLocation {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    isActive: row.isActive,
    addressLine1: row.address.addressLine1,
    addressLine2: row.address.addressLine2 ?? undefined,
    landmark: row.address.landmark ?? undefined,
    city: row.address.city,
    state: row.address.state,
    pincode: row.address.pincode,
    country: row.address.country,
    stockedProducts: row._count.productStock,
    shipmentCount: row._count.shipments,
  };
}

export class OrgAddressRepository {
  async listByOrg(orgId: string): Promise<OrgLocation[]> {
    const rows = await prisma.orgAddress.findMany({
      where: { orgId },
      include: ROW_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toOrgLocation);
  }

  /** Ownership is the query: another org's location is simply not found. */
  async findOwned(orgId: string, locationId: string): Promise<OrgLocation | null> {
    const row = await prisma.orgAddress.findFirst({
      where: { id: locationId, orgId },
      include: ROW_INCLUDE,
    });
    return row ? toOrgLocation(row) : null;
  }

  async add(orgId: string, input: OrgLocationWrite, createdBy?: string): Promise<OrgLocation> {
    const address = await addressRepository.create(
      {
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        landmark: input.landmark,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
      },
      createdBy
    );
    const row = await prisma.orgAddress.create({
      data: {
        orgId,
        addressId: address.id,
        name: input.name,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        isActive: input.isActive ?? true,
      },
      include: ROW_INCLUDE,
    });
    return toOrgLocation(row);
  }

  async update(
    orgId: string,
    locationId: string,
    input: Partial<OrgLocationWrite>
  ): Promise<OrgLocation | null> {
    const owned = await prisma.orgAddress.findFirst({
      where: { id: locationId, orgId },
      select: { id: true, addressId: true },
    });
    if (!owned) return null;

    // Postal edits mutate the Address row; shipped parcels are unaffected because a
    // shipment records its own from* snapshot (TRD D5 / A5).
    await addressRepository.update(owned.addressId, {
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      landmark: input.landmark,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
    });
    const row = await prisma.orgAddress.update({
      where: { id: owned.id },
      data: {
        name: input.name,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        isActive: input.isActive,
      },
      include: ROW_INCLUDE,
    });
    return toOrgLocation(row);
  }

  /**
   * Delete, clearing only join rows that hold nothing. Rows with units, or parcels
   * naming the location, surface as the FK RESTRICT this call lets propagate — the
   * service turns the pre-checked counts into a friendly message first.
   */
  async remove(orgId: string, locationId: string): Promise<boolean> {
    const owned = await prisma.orgAddress.findFirst({
      where: { id: locationId, orgId },
      select: { id: true },
    });
    if (!owned) return false;

    await prisma.$transaction(async (tx) => {
      await tx.productStock.deleteMany({
        where: { orgAddressId: owned.id, quantity: 0 },
      });
      await tx.orgAddress.delete({ where: { id: owned.id } });
    });
    return true;
  }
}

export const orgAddressRepository = new OrgAddressRepository();
