"use client";

import { ContactLauncher } from "@/components/support/contact-launcher";
import type { Feature } from "@server/subscriptions/feature-access.types";
import { FEATURE_NAME, LOCK_COPY } from "./subscriptions-copy";

/** "Talk to us" from a lock: the contact sheet, its words already naming the feature and the shop (Q26). */
export function TalkToUs({
  feature,
  shop,
  variant = "default",
  className,
}: {
  feature: Feature;
  shop: string;
  variant?: "default" | "link" | "outline";
  className?: string;
}) {
  const name = FEATURE_NAME[feature];
  return (
    <ContactLauncher
      variant={variant}
      className={className}
      prefill={{ subject: LOCK_COPY.partOfPlan(name), message: LOCK_COPY.prefill(name, shop) }}
    >
      {LOCK_COPY.talkToUs}
    </ContactLauncher>
  );
}
