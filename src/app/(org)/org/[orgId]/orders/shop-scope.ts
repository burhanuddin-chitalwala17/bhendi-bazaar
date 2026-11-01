import { requireOrgMember, type OrgScope } from "@/lib/org-auth";
import { isDomainError } from "@server/shared/domain-error";

/**
 * The page's own membership check: a layout's check does not stop a nested page rendering
 * (Next 16 authentication guide, "Layouts and auth checks"). Null means refused (403).
 */
export async function shopScopeOrRefused(orgId: string): Promise<OrgScope | null> {
  try {
    return await requireOrgMember(orgId);
  } catch (error) {
    if (isDomainError(error) && error.status === 403) return null;
    throw error;
  }
}
