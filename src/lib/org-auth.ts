import { cache } from "react";
import type { NextRequest } from "next/server";
import type { OrgRole } from "@prisma/client";
import { requireSession } from "@/lib/admin-auth";
import { orgMemberRepository } from "@server/catalog/org.member.repository";
import { ForbiddenError } from "@server/shared/domain-error";
import { toErrorResponse } from "@/lib/api-error-response";

/**
 * Permission to act for one org, and the id every subsequent query filters on.
 *
 * The `orgId` is here rather than taken from the path a second time so that being
 * authorised and being scoped are the same act — a boolean would leave the filter as a
 * step someone can omit, and an omitted filter is another org's data.
 */
export interface OrgScope {
  orgId: string;
  role: OrgRole;
  userId: string;
}

async function resolveOrgScope(orgId: string): Promise<OrgScope> {
  const session = await requireSession();

  // No platform-admin bypass, deliberately (portal-separation trd.md D6). A bypass is an
  // exception inside a filter that must never fail, and exceptions are where leaks live.
  const membership = await orgMemberRepository.findMembership(session.user.id, orgId);
  if (!membership) {
    throw new ForbiddenError("You do not have access to this organisation");
  }

  return { orgId: membership.orgId, role: membership.role, userId: session.user.id };
}

/**
 * For server components. Memoised per request, so several components on one page share
 * one lookup — never across requests, because a membership revoked by the team page has
 * to take effect on the next request rather than at the next sign-in.
 */
export const requireOrgMember = cache(resolveOrgScope);

/**
 * For route handlers. Wraps the handler rather than sitting inside it, so the scope the
 * body receives can only have come from a check that passed: a handler that skips this
 * has no `orgId` to query with.
 *
 * Deliberately not the memoised variant — a handler does one check, so there is nothing
 * to share, and `cache()` outside a React render has no request scope to key on.
 */
export function withOrg<P extends { orgId: string }>(
  handler: (request: NextRequest, scope: OrgScope, params: P) => Promise<Response>
) {
  return async (request: NextRequest, context: { params: Promise<P> }) => {
    try {
      const params = await context.params;
      const scope = await resolveOrgScope(params.orgId);
      return await handler(request, scope, params);
    } catch (error) {
      return toErrorResponse(error, "Something went wrong");
    }
  };
}
