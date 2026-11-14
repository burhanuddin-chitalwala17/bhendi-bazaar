import type { Metadata } from "next";

import { AUDIENCE, BUSINESS_COPY } from "@/components/org/business/business-copy";
import { BusinessPage } from "@/components/org/business/business-page";
import { appUrl } from "@server/shared/app-url";
import { ROUTES } from "@server/shared/routes";

export const metadata: Metadata = {
  title: BUSINESS_COPY.meta.title,
  description: BUSINESS_COPY.meta.description,
  alternates: { canonical: `${appUrl()}${ROUTES.business}` },
};

export default async function BusinessRoute({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: audience } = await searchParams;
  return <BusinessPage audience={audience === AUDIENCE.PARTNER ? AUDIENCE.PARTNER : AUDIENCE.SHOP} />;
}
