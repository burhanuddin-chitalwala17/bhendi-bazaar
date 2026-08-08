"use client";

import { useParams } from "next/navigation";

/**
 * Where the product screens live in whichever portal the user is currently in.
 *
 * The product containers are shared between `/admin/products` and
 * `/org/[orgId]/products`, so a hardcoded path in one of them would send an org member
 * into the platform tree — which they may not be allowed to open at all.
 */
export function useProductsBasePath(): string {
  const params = useParams();
  const orgId = typeof params.orgId === "string" ? params.orgId : undefined;
  return orgId ? `/org/${orgId}/products` : "/admin/products";
}
