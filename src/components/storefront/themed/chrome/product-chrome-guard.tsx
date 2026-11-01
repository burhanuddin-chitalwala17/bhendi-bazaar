"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { isShopProductPath } from "@/lib/storefront-chrome";

/**
 * A layout is not re-rendered on a client navigation, so the shop's chrome drawn around one of
 * its products would otherwise follow the buyer onto any marketplace page. Leaving the shop's
 * product refetches the tree, and middleware then forwards no shop (Q33).
 */
export function ProductChromeGuard({ handle }: { handle: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const stays = isShopProductPath(pathname, searchParams.get("shop"), handle);

  useEffect(() => {
    if (!stays) router.refresh();
  }, [stays, router]);

  return null;
}
