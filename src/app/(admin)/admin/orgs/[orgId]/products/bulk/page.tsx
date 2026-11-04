import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BulkProductWizard } from "@/components/bulk-upload/BulkProductWizard";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { getTeamBulkSheetChoices } from "@/data-access-layer/admin/bulk-sheet.dal";
import { TEAM_BULK_COPY } from "@server/catalog/bulk/sheet-copy";

/** The Bhendi Bazaar team adding many products for a shop, in the shop's own four steps (own-store/bulk-sheet R9). */
export default async function AdminBulkForShopPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [org, choices] = await Promise.all([orgsDAL.getById(orgId), getTeamBulkSheetChoices(orgId)]);
  if (!org) notFound();

  const header = <PageHeader back={{ href: `/admin/orgs/${orgId}`, label: org.name }} title="Add many for this shop" />;
  // A shop that cannot sell takes no new products; the create route refuses it too (ux.md, Admin: Refused).
  const refusal = !org.isActive || org.isBlocked ? TEAM_BULK_COPY.deactivated(org.name) : null;
  // A stock column needs somewhere to keep stock, and the address is the shop's to give (ux.md, Admin: Empty).
  const empty = !choices.hasLocation ? TEAM_BULK_COPY.noLocation(org.name) : null;

  if (refusal || empty) {
    return (
      <PageShell>
        {header}
        <p role="status" className="break-words rounded-card border border-warning/40 bg-warning/10 p-4 text-small text-foreground">
          {refusal ?? empty}
        </p>
        {/* "Add location" waits for an admin address surface (product-form Q37); until then, the shop's page. */}
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/admin/orgs/${orgId}`}>{refusal ? TEAM_BULK_COPY.openShop : `Back to ${org.name}`}</Link>
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {header}
      <BulkProductWizard orgId={orgId} choices={choices} team={{ shopName: org.name }} />
    </PageShell>
  );
}
