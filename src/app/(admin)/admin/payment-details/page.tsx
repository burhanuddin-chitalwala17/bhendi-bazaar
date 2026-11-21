/**
 * Where shops send a top-up for AI picture credit, and the platform's margin on those pictures
 * (ai-images/shop-credits R6, R11; Q35). Shops see the details exactly as saved here.
 */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { PaymentDetailsForm } from "@/components/payouts/payment-details-form";
import { PlatformMarginForm } from "@/components/payouts/platform-margin-form";
import { PAYMENT_DETAILS_COPY } from "@/components/payouts/credits-copy";
import { creditService } from "@server/payouts/credit.service";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPaymentDetailsPage() {
  await requirePlatformAdmin();
  const [details, marginBps] = await Promise.all([creditService.paymentDetails(), creditService.platformMargin()]);
  return (
    <PageShell>
      <PageHeader title={PAYMENT_DETAILS_COPY.title} description={PAYMENT_DETAILS_COPY.description} />
      <PaymentDetailsForm initial={details} />
      <PlatformMarginForm initialBps={marginBps} />
    </PageShell>
  );
}
