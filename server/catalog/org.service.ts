// src/server/services/admin/org.service.ts

import { orgRepository } from "@server/catalog/org.repository";
import type { CreateOrgInput } from "@server/catalog/org.types";
import type { CreateOrgInput as CreateOrgSchemaInput } from "@/lib/validation/schemas/org.schema";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import { orgCodeCandidates } from "@server/catalog/org.code";
import { handleCandidates } from "@server/catalog/org.handle";
import { isUniqueViolation } from "@server/shared/constraint";
import { DEFAULT_PAGE_SIZE, type Pagination } from "@server/shared/pagination";

export class AdminOrgService {
  /** One page of orgs for the admin listing — search, status and paging all server-side. */
  async listOrgs(filters: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<{ orgs: Awaited<ReturnType<typeof orgRepository.findPageWithStats>>["orgs"]; pagination: Pagination }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? DEFAULT_PAGE_SIZE;
    const { orgs, total } = await orgRepository.findPageWithStats({
      page,
      limit,
      search: filters.search,
      isActive: filters.isActive,
    });

    return {
      orgs,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
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
    const codes = orgCodeCandidates();
    const handles = handleCandidates(data.name);
    let code = codes.next().value as string;
    let handle = handles.next().value as string;

    for (let attempt = 0; ; attempt++) {
      try {
        // A new org is active by definition; deactivation is an admin act later.
        return await insert({ ...data, code, handle, isActive: true });
      } catch (error) {
        // Two generated identifiers, two collision domains — advance only the one the
        // database actually objected to, or a handle collision would burn through codes
        // and a name like "Traders" would never reach `traders-2`.
        if (attempt < 25 && isUniqueViolation(error, "code")) {
          code = codes.next().value as string;
          continue;
        }
        if (attempt < 25 && isUniqueViolation(error, "handle")) {
          handle = handles.next().value as string;
          continue;
        }
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