/**
 * The one thing the users console asks the browser to do: block or unblock someone.
 *
 * There is no `getUsers` here. The listing is read by a server component through
 * `adminUsersDAL` ([ADR-0034]) — a fetch would be a round trip for data the server already
 * had. `updateUser` went with it: a `PATCH` that could set `platformRole` had no caller and
 * no screen, and an unreachable route with that much authority is surface, not a feature.
 */

import type { AdminUser } from "@/domain/admin";
import { readApiError } from "@/lib/api-error";

class AdminUserService {
  async toggleBlockUser(id: string, isBlocked: boolean): Promise<AdminUser> {
    const response = await fetch(`/api/admin/users/${id}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked }),
    });

    if (!response.ok) throw await readApiError(response);
    return response.json();
  }
}

export const adminUserApiClient = new AdminUserService();
