import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { StorePolicies } from "@/components/support/store-policies";
import { APP_NAME } from "@/lib/config";
import { ABANDONED_HOLD_MINUTES } from "@server/payments/payment.service";
import { appUrl } from "@server/shared/app-url";
import { POLICIES_PAGE_COPY } from "./policies-page-copy";
import { ROUTES } from "@server/shared/routes";

export const metadata: Metadata = {
  title: POLICIES_PAGE_COPY.title,
  description: POLICIES_PAGE_COPY.metaDescription(APP_NAME),
  alternates: { canonical: `${appUrl()}${ROUTES.policies}` },
};

/** Bumped by hand with any change to what the page promises. */
const UPDATED_ON = "14 October 2026";

export default function PoliciesPage() {
  return (
    <PageShell width="narrow">
      <PageHeader
        title={POLICIES_PAGE_COPY.title}
        description={POLICIES_PAGE_COPY.description}
      />
      <StorePolicies holdMinutes={ABANDONED_HOLD_MINUTES} updatedOn={UPDATED_ON} />
    </PageShell>
  );
}
