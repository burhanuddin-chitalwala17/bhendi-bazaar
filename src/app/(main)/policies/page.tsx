import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { StorePolicies } from "@/components/support/store-policies";
import { APP_NAME } from "@/lib/config";
import { ABANDONED_HOLD_MINUTES } from "@server/payments/payment.service";
import { appUrl } from "@server/shared/app-url";

export const metadata: Metadata = {
  title: "Store policies",
  description: `Shipping, cancellation, returns, refunds, privacy and terms at ${APP_NAME}.`,
  alternates: { canonical: `${appUrl()}/policies` },
};

/** Bumped by hand with any change to what the page promises. */
const UPDATED_ON = "14 October 2026";

export default function PoliciesPage() {
  return (
    <PageShell width="narrow">
      <PageHeader
        title="Store policies"
        description="How we ship, cancel, return and refund, and how we look after your data."
      />
      <StorePolicies holdMinutes={ABANDONED_HOLD_MINUTES} updatedOn={UPDATED_ON} />
    </PageShell>
  );
}
