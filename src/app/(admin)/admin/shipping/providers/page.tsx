import type { Metadata } from "next";

import { ProvidersContainer } from "@/components/shipping/providers-console";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageShell } from "@/components/shared/page-shell";

export const metadata: Metadata = {
  title: "Admin: shipping providers",
  description: "Manage shipping providers",
};

export default function ShippingProvidersPage() {
  return (
    <PageShell>
      <PageHeader title="Shipping providers" description="The courier accounts parcels can be booked with." />

      <Card className="flex-row gap-3 p-4">
        <Icon name="info" size="md" tone="primary" />
        <div className="space-y-1 text-small">
          <h2 className="font-semibold text-foreground">How it works</h2>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Connect a provider's account to use it for bookings.</li>
            <li>Disconnect it to stop using it for now.</li>
            <li>When more than one is connected, the higher priority is preferred.</li>
          </ul>
        </div>
      </Card>

      <ProvidersContainer />
    </PageShell>
  );
}
