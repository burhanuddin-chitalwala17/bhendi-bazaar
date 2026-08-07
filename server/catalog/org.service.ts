// src/server/services/admin/org.service.ts

import { orgRepository } from "@server/catalog/org.repository";
import type { CreateOrgInput } from "@/domain/org";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";

export class AdminOrgService {
  /**
   * Get all orgs with optional stats
   */
  async getAllOrgs(includeStats = false) {
    return await orgRepository.findAll(includeStats);
  }

  /**
   * Get single org by ID
   */
  async getOrg(id: string) {
    const org = await orgRepository.findById(id);

    if (!org) {
      throw new NotFoundError("Org not found");
    }

    return org;
  }

  /**
   * Create new org with validation
   */
  async createOrg(data: CreateOrgInput) {
    // Business validation: Check for duplicates
    const existingCode = await orgRepository.findByCode(data.code);
    if (existingCode) {
      throw new ConflictError("Org code already exists");
    }

    // Create org
    return await orgRepository.create(data);
  }

  /**
   * Update org with validation
   */
  async updateOrg(id: string, data: Partial<CreateOrgInput>) {
    // Update org
    return await orgRepository.update(id, data);
  }

  /**
   * Delete org with business rules
   */
  async deleteOrg(id: string) {
    // Check if org exists
    const org = await orgRepository.findById(id);
    if (!org) {
      throw new NotFoundError("Org not found");
    }

    // Business rule: Cannot delete org with products
    const productCount = await orgRepository.countProducts(id);
    if (productCount > 0) {
      throw new DomainError(`Cannot delete org with products. This org has ${productCount} product(s). Please reassign or delete them first.`);
    }

    // Delete org
    return await orgRepository.delete(id);
  }
}

export const adminOrgService = new AdminOrgService();