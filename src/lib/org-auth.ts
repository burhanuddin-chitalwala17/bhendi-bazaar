import { cache } from "react";
import type { NextRequest } from "next/server";
import type { OrgRole } from "@prisma/client";
import { requireSession } from "@/lib/admin-auth";
import { orgMemberRepository } from "@server/catalog/org.member.repository";
import { DomainError, ForbiddenError } from "@server/shared/domain-error";
import { toErrorResponse } from "@/lib/api-error-response";
import { ERROR_RESPONSE_COPY } from "@/lib/lib-copy";
import { featureAccessService, holds, lockedError } from "@server/subscriptions/feature-access.service";
import type { Feature, FeatureAccessDTO } from "@server/subscriptions/feature-access.types";

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
  /** What this shop may use of the paid features, read beside the membership (feature-access D6). */
  features: FeatureAccessDTO;
}

export async function resolveOrgScope(orgId: string): Promise<OrgScope> {
  const session = await requireSession();

  // One extra read, in parallel; not folded into catalog's query, which would read a table it does not own (D6).
  const [membership, features] = await Promise.all([
    orgMemberRepository.findMembership(session.user.id, orgId),
    featureAccessService.forOrg(orgId),
  ]);
  if (!membership) {
    throw new ForbiddenError("You do not have access to this organisation");
  }

  if (membership.orgBlocked) {
    throw new DomainError("This organisation has been suspended", { status: 403 });
  }

  return { orgId: membership.orgId, role: membership.role, userId: session.user.id, features };
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
  handler: (request: NextRequest, scope: OrgScope, params: P) => Promise<Response>,
  options: { feature?: Feature } = {},
) {
  return async (request: NextRequest, context: { params: Promise<P> }) => {
    try {
      const params = await context.params;
      const scope = await resolveOrgScope(params.orgId);
      // A paid route refuses before its handler, from the scope already read (feature-access D7).
      if (options.feature && !holds(scope.features, options.feature)) throw lockedError(options.feature);
      return await handler(request, scope, params);
    } catch (error) {
      return toErrorResponse(error, ERROR_RESPONSE_COPY.somethingWentWrong);
    }
  };
}
