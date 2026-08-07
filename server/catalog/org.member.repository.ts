import { prisma } from "@server/shared/prisma";
import { OrgRole } from "@prisma/client";

/**
 * The only module that writes `OrgMember` (Invariant 5).
 *
 * Deliberately small: `findMembership` is the primitive every org-scoped request needs,
 * and the rest of the team surface — listing, changing a role, removing someone — waits
 * for org-team, whose requirement that an org cannot be left unadministered decides what
 * removal means. Guessing that rule here would be worse than not having the method.
 */
export class OrgMemberRepository {
  /**
   * The membership authorising this person to act for this org, or `null`.
   *
   * Read on the request rather than taken from a session token: a membership can be
   * revoked between sign-in and now, and a token would keep asserting it.
   */
  async findMembership(userId: string, orgId: string) {
    return prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { id: true, orgId: true, role: true },
    });
  }

  /** The orgs this person can act for — the org switcher's list, and "do you have one at all". */
  async listOrgsForUser(userId: string) {
    const memberships = await prisma.orgMember.findMany({
      where: { userId },
      select: {
        role: true,
        org: { select: { id: true, code: true, name: true, isActive: true } },
      },
      orderBy: { org: { name: "asc" } },
    });

    return memberships.map(({ org, role }) => ({ ...org, role }));
  }

  /**
   * Add a person to an org.
   *
   * The unique constraint decides whether they are already a member; asking first would
   * be a race the database already arbitrates (same reasoning as slug generation).
   */
  async addMember(userId: string, orgId: string, role: OrgRole) {
    return prisma.orgMember.create({
      data: { userId, orgId, role },
      select: { id: true, orgId: true, role: true },
    });
  }
}

export const orgMemberRepository = new OrgMemberRepository();
