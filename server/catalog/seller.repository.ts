// src/server/repositories/admin/seller.repository.ts

import { prisma } from "@server/shared/prisma";
import type { Seller } from "@prisma/client";
import type { CreateSellerInput } from "@/domain/seller";

export class SellerRepository {
  /**
   * Get all sellers with optional stats
   */
  async findAll(includeStats = false) {
    if (includeStats) {
      const sellers = await prisma.seller.findMany({
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
      return sellers.map((seller: any) => ({
        ...seller,
        productCount: seller._count?.products || 0,
        totalStock:
          seller.products?.reduce((sum: number, p: any) => sum + p.stock, 0) ||
          0,
        products: undefined, // Remove to avoid sending all products
        _count: undefined, // Remove internal field
      }));
    }

    return await prisma.seller.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  /**
   * Find seller by ID
   */
  async findById(id: string) {
    const seller = await prisma.seller.findUnique({
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
    if (!seller) return null;
    // Calculate stats
    return {
      ...seller,
      productCount: seller._count?.products || 0,
      totalStock:
        seller.products?.reduce((sum: number, p: any) => sum + p.stock, 0) || 0,
      products: undefined, // Remove to avoid sending all products
      _count: undefined, // Remove internal field
    };
  }

  /**
   * Find seller by code
   */
  async findByCode(code: string) {
    return await prisma.seller.findUnique({
      where: { code },
    });
  }

  /**
   * Find seller by email
   */
  async findByEmail(email: string) {
    return await prisma.seller.findMany({
      where: { email },
    });
  }

  /**
   * Find seller by GST number
   */
  async findByGstNumber(gstNumber: string) {
    return await prisma.seller.findMany({
      where: { gstNumber },
    });
  }

  /**
   * Create new seller
   */
  async create(data: CreateSellerInput): Promise<Seller> {
    return await prisma.seller.create({
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
   * Update seller
   */
  async update(id: string, data: Partial<CreateSellerInput>) {
    // after updating return the product count and stock
    await prisma.seller.update({
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
    const sellerWithStats = await this.findById(id);
    return sellerWithStats;
  }

  /**
   * Delete seller
   */
  async delete(id: string): Promise<Seller> {
    return await prisma.seller.delete({
      where: { id },
    });
  }

  /**
   * Count products for a seller
   */
  async countProducts(sellerId: string): Promise<number> {
    return await prisma.product.count({
      where: { sellerId },
    });
  }
}

export const sellerRepository = new SellerRepository();
