"use client";

import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CHECKOUT_LINK_COPY } from "./checkout-link-copy";

/** The product page opened from an expired checkout link says so (checkout-links R5, ux.md: Expired). */
export function ExpiredLinkLine() {
  if (useSearchParams().get("link") !== "expired") return null;
  return (
    <Alert>
      <AlertDescription>{CHECKOUT_LINK_COPY.expired}</AlertDescription>
    </Alert>
  );
}
