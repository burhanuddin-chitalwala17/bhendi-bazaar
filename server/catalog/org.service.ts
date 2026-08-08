// src/server/services/admin/org.service.ts

import { orgRepository } from "@server/catalog/org.repository";
import type { CreateOrgInput } from "@/domain/org";
import type { CreateOrgInput as CreateOrgSchemaInput } from "@/lib/validation/schemas/org.schema";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import { orgCodeCandidates } from "@server/catalog/org.code";
import { isUniqueViolation } from "@server/shared/constraint";

export class AdminOrgService {
  /**
   * Get all orgs with optional stats
   */
  async getAllOrgs(includeStats = false) {
    return includeStats
      ? await orgRepository.findAllWithStats()
      : await orgRepository.findAll();
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
  async createOrg(data: CreateOrgSchemaInput) {
    return await this.insertWithGeneratedCode((row) => orgRepository.create(row), data);
  }

  /**
   * Create an org with the caller as its owner. Self-serve, so unlike `createOrg` this
   * is reachable by anyone signed in.
   */
  async createOrgWithOwner(data: CreateOrgSchemaInput, userId: string) {
    return await this.insertWithGeneratedCode(
      (row) => orgRepository.createWithOwner(row, userId),
      data
    );
  }

  /**
   * Insert with a server-generated code, retrying on collision. The unique constraint
   * decides — a prior `findByCode` was a read-then-write race, and with generated codes
   * a collision is an internal retry, never a user error.
   */
  private async insertWithGeneratedCode<T>(
    insert: (row: CreateOrgInput) => Promise<T>,
    data: CreateOrgSchemaInput
  ): Promise<T> {
    const candidates = orgCodeCandidates();
    for (let attempt = 0; ; attempt++) {
      const code = candidates.next().value as string;
      try {
        // A new org is active by definition; deactivation is an admin act later.
        return await insert({ ...data, code, isActive: true });
      } catch (error) {
        if (isUniqueViolation(error, "code") && attempt < 25) continue;
        throw error;
      }
    }
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