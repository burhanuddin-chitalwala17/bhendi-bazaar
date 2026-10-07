import { cache } from "react";
import type { UserListFilters, UserListResult, AdminUser } from "@/domain/admin";
import { adminUserService } from "@server/identity/admin.user.service";

class UsersDAL {
  list = cache(async (filters: UserListFilters): Promise<UserListResult> => {
    return adminUserService.getUsers(filters);
  });

  getById = cache(async (id: string): Promise<AdminUser | null> => {
    return adminUserService.getUserById(id);
  });
}

export const adminUsersDAL = new UsersDAL();
