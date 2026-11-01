"use client";

import { usePathname } from "next/navigation";
import { listingApiPrefix } from "@/components/product/listingApiClient";

/** The shop's listing reads, through the team's routes when the form is open under /admin (product-form D12). */
export function useListingPrefix(orgId: string): string {
  const pathname = usePathname();
  return listingApiPrefix(orgId, !!pathname?.startsWith("/admin/"));
}
