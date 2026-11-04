"use client";

import { useParams, usePathname } from "next/navigation";
import { ROUTES } from "@server/shared/routes";

/**
 * Where the product screens live in whichever portal the user is currently in.
 *
 * The product containers are shared between `/admin/products`,
 * `/org/[orgId]/products`, and the admin org detail (`/admin/orgs/[orgId]`).
 * A hardcoded path in one of them would send a user into the wrong portal.
 */
export function useProductsBasePath(): string {
  const params = useParams();
  const pathname = usePathname();
  if (pathname.startsWith(`${ROUTES.admin.home}/`)) return ROUTES.admin.products;
  const orgId = typeof params.orgId === "string" ? params.orgId : undefined;
  return orgId ? ROUTES.org.products(orgId) : ROUTES.admin.products;
}
