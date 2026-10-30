// src/server/services/admin/org.service.ts

import { orgRepository } from "@server/catalog/org.repository";
import { orgProfileRepository } from "@server/catalog/org-profile.repository";
import type { CreateOrgInput } from "@server/catalog/org.types";
import type {
  CreateOrgInput as CreateOrgSchemaInput,
  OpenShopInput,
} from "@/lib/validation/schemas/org.schema";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import { orgCodeCandidates } from "@server/catalog/org.code";
import { handleCandidates } from "@server/catalog/org.handle";
import { isUniqueViolation } from "@server/shared/constraint";
import { DEFAULT_PAGE_SIZE, type Pagination } from "@server/shared/pagination";
import { orgMemberRepository } from "@server/catalog/org.member.repository";

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
   * Name and code for a set of orgs, for a console that holds ids and needs to print them.
   * One query for the set: a listing that resolves a name per row is an N+1 waiting to be found.
   */
  async summariesFor(ids: string[]) {
    if (ids.length === 0) return [];
    return await orgRepository.findSummaries(ids);
  }

  /**
   * Create new org with validation
   */
  async createOrg(data: CreateOrgSchemaInput) {
    return await this.insertWithGeneratedCode((row) => orgRepository.create(row), data);
  }

  /**
   * Create an org with the caller as its owner. Self-serve, so unlike `createOrg` this
   * is reachable by anyone signed in, and takes only the three fields a shop opens with
   * (org-profile D1).
   */
  async createOrgWithOwner(data: OpenShopInput, userId: string) {
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
  /**
   * Whether this person belongs to this organisation.
   *
   * A boolean rather than the membership row, because that is the whole question the callers
   * ask: `bidding` refuses a bid on your own org's item. Anything needing the *role* is making
   * an authorisation decision and belongs in `src/lib/org-auth.ts`, where being authorised and
   * being scoped are one act.
   */
  async isMember(userId: string, orgId: string): Promise<boolean> {
    return Boolean(await orgMemberRepository.findMembership(userId, orgId));
  }

  /**
   * Who to write to about this organisation — the name and address a payout or settlement
   * email is sent to. On the service because `payouts` asks it (ADR-0033).
   */
  async findEmailContact(id: string) {
    return await orgRepository.findEmailContact(id);
  }

  async updateOrg(id: string, data: Partial<CreateOrgInput>) {
    const { description, ...org } = data;
    // Two repositories, two tables: the introduction is public face and lives on the profile.
    if (description !== undefined) {
      await orgProfileRepository.updateDescription(id, description || null);
    }
    return await orgRepository.update(id, org);
  }

  async blockOrg(id: string) {
    const org = await orgRepository.findById(id);
    if (!org) throw new NotFoundError("Org not found");
    return await orgRepository.setBlocked(id, true);
  }

  async unblockOrg(id: string) {
    const org = await orgRepository.findById(id);
    if (!org) throw new NotFoundError("Org not found");
    return await orgRepository.setBlocked(id, false);
  }
}

export const adminOrgService = new AdminOrgService();