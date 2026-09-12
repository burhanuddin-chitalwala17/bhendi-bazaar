/**
 * Setting the terms for one item.
 *
 * The product arrives as a query parameter from the picker, but nothing trusts it: the
 * facts are read here scoped to this organisation's membership, so a hand-edited id for
 * someone else's product resolves to nothing rather than to a form.
 *
 * The current selling price is shown rather than remembered, so the opening bid is set
 * against a real number (spec R3).
 */
import { notFound } from "next/navigation";
import { requireOrgMember } from "@/lib/org-auth";
import { biddingService } from "@server/bidding/bidding.service";
import { NotFoundError } from "@server/shared/domain-error";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BiddingForm } from "@/components/bidding/BiddingForm";

export const metadata = { robots: { index: false, follow: false } };

export default async function NewBiddingEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ productId?: string }>;
}) {
  const { orgId } = await params;
  const { productId } = await searchParams;
  const scope = await requireOrgMember(orgId);
  if (!productId) notFound();

  const facts = await biddingService
    .productFacts(scope.orgId, productId)
    .catch((error) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Set up bidding"
        description={facts.name}
        back={{ href: `/org/${scope.orgId}/bidding`, label: "Back to bidding" }}
      />
      <BiddingForm
        action={`/api/org/${scope.orgId}/bidding`}
        returnTo={`/org/${scope.orgId}/bidding`}
        product={facts}
      />
    </PageShell>
  );
}
