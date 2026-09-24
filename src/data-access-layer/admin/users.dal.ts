// DATA ACCESS LAYER FOR ADMIN USERS

import { cache } from "react";
import type { UserListFilters, UserListResult } from "@/domain/admin";
import { adminUserService } from "@server/identity/admin.user.service";

/**
 * The console's user list, read on the server so the page renders it rather than fetching it
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 *
 * Memoised per request like the other admin DALs: the page and anything else on it that asks
 * the same question share one read.
 */
class UsersDAL {
  list = cache(async (filters: UserListFilters): Promise<UserListResult> => {
    return adminUserService.getUsers(filters);
  });
}

export const adminUsersDAL = new UsersDAL();
