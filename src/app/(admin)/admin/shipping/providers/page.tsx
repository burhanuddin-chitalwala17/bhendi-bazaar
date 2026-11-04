import type { Metadata } from "next";

import { ProvidersContainer } from "@/components/shipping/providers-console";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ADMIN_SHIPPING_COPY } from "../shipping-copy";

export const metadata: Metadata = {
  title: ADMIN_SHIPPING_COPY.metaTitle,
  description: ADMIN_SHIPPING_COPY.metaDescription,
};

export default function ShippingProvidersPage() {
  return (
    <PageShell>
      <PageHeader title={ADMIN_SHIPPING_COPY.title} description={ADMIN_SHIPPING_COPY.description} />

      <Card className="flex-row gap-3 p-4">
        <Icon name="info" size="md" tone="primary" />
        <div className="space-y-1 text-small">
          <h2 className="font-semibold text-foreground">{ADMIN_SHIPPING_COPY.howItWorks}</h2>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>{ADMIN_SHIPPING_COPY.connect}</li>
            <li>{ADMIN_SHIPPING_COPY.disconnect}</li>
            <li>{ADMIN_SHIPPING_COPY.priority}</li>
          </ul>
        </div>
      </Card>

      <ProvidersContainer />
    </PageShell>
  );
}
