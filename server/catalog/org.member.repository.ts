import { prisma } from "@server/shared/prisma";

/**
 * Reads of `OrgMember`. The table's one writer is `org.repository.ts` (`createWithOwner`):
 * the first owner is part of creating the org, and no other membership write exists yet.
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
    const row = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { id: true, orgId: true, role: true, org: { select: { isBlocked: true } } },
    });
    if (!row) return null;
    return { id: row.id, orgId: row.orgId, role: row.role, orgBlocked: row.org.isBlocked };
  }

  /** The orgs this person can act for — the org switcher's list, and "do you have one at all". */
  async listOrgsForUser(userId: string) {
    const memberships = await prisma.orgMember.findMany({
      where: { userId },
      select: {
        role: true,
        org: {
          select: {
            id: true,
            name: true,
            handle: true,
            isActive: true,
            isBlocked: true,
          },
        },
      },
      orderBy: { org: { name: "asc" } },
    });

    return memberships.map(({ org, role }) => ({ ...org, role }));
  }

  /** Everyone with a seat at this org: who the notifications hub tells about it (notifications-core Q2). */
  async listMemberIds(orgId: string): Promise<string[]> {
    const rows = await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true }, orderBy: { userId: "asc" } });
    return rows.map((r) => r.userId);
  }
}

export const orgMemberRepository = new OrgMemberRepository();
