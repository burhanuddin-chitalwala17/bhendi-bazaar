/**
 * The one thing the users console asks the browser to do: block or unblock someone. The listing
 * is read by a server component through `adminUsersDAL` ([ADR-0034]).
 */

import { apiRequest } from "@/lib/api-client";
import type { AdminUser } from "@/domain/admin";

export const adminUserApiClient = {
  toggleBlockUser(id: string, isBlocked: boolean): Promise<AdminUser> {
    return apiRequest(`/api/admin/users/${id}/block`, { method: "POST", body: { isBlocked } });
  },
};
