// src/server/repositories/admin/org.repository.ts

import { prisma } from "@server/shared/prisma";
import type { Org } from "@prisma/client";
import type { CreateOrgInput } from "@/domain/org";

export class OrgRepository {
  /**
   * Get all orgs with optional stats
   */
  async findAll(includeStats = false) {
    if (includeStats) {
      const orgs = await prisma.org.findMany({
        include: {
          _count: {
            select: { products: true },
          },
          products: {
            select: { stock: true },
          },
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      });

      // Calculate stats
      return orgs.map((org: any) => ({
        ...org,
        productCount: org._count?.products || 0,
        totalStock:
          org.products?.reduce((sum: number, p: any) => sum + p.stock, 0) ||
          0,
        products: undefined, // Remove to avoid sending all products
        _count: undefined, // Remove internal field
      }));
    }

    return await prisma.org.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  /**
   * Find org by ID
   */
  async findById(id: string) {
    const org = await prisma.org.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
        products: {
          select: { stock: true },
        },
      },
    });
    if (!org) return null;
    // Calculate stats
    return {
      ...org,
      productCount: org._count?.products || 0,
      totalStock:
        org.products?.reduce((sum: number, p: any) => sum + p.stock, 0) || 0,
      products: undefined, // Remove to avoid sending all products
      _count: undefined, // Remove internal field
    };
  }

  /**
   * Find org by code
   */
  async findByCode(code: string) {
    return await prisma.org.findUnique({
      where: { code },
    });
  }

  /**
   * Find org by email
   */
  async findByEmail(email: string) {
    return await prisma.org.findMany({
      where: { email },
    });
  }

  /**
   * Find org by GST number
   */
  async findByGstNumber(gstNumber: string) {
    return await prisma.org.findMany({
      where: { gstNumber },
    });
  }

  /**
   * Create new org
   */
  async create(data: CreateOrgInput): Promise<Org> {
    return await prisma.org.create({
      data: {
        ...data,
        // Convert empty strings to null for optional fields
        phone: data.phone || null,
        contactPerson: data.contactPerson || null,
        defaultAddress: data.defaultAddress || null,
        businessName: data.businessName || null,
        gstNumber: data.gstNumber || null,
        panNumber: data.panNumber || null,
        description: data.description || null,
      },
    });
  }

  /**
   * Update org
   */
  async update(id: string, data: Partial<CreateOrgInput>) {
    // after updating return the product count and stock
    await prisma.org.update({
      where: { id },
      data: {
        ...data,
        // Convert empty strings to null for optional fields
        phone: data.phone || null,
        contactPerson: data.contactPerson || null,
        defaultAddress: data.defaultAddress || null,
        businessName: data.businessName || null,
        gstNumber: data.gstNumber || null,
        panNumber: data.panNumber || null,
        description: data.description || null,
      },
    });
    const orgWithStats = await this.findById(id);
    return orgWithStats;
  }

  /**
   * Delete org
   */
  async delete(id: string): Promise<Org> {
    return await prisma.org.delete({
      where: { id },
    });
  }

  /**
   * Count products for a org
   */
  async countProducts(orgId: string): Promise<number> {
    return await prisma.product.count({
      where: { orgId },
    });
  }
}

export const orgRepository = new OrgRepository();
