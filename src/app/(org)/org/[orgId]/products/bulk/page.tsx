import { requireOrgMember } from "@/lib/org-auth";
import { BulkProductWizard } from "@/components/bulk-upload/BulkProductWizard";
import { getBulkSheetChoices } from "@/data-access-layer/org/bulk-sheet.dal";
import { PageHeader } from "@/components/shared/page-shell";

export const metadata = { robots: { index: false, follow: false } };

export default async function BulkUploadPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const choices = await getBulkSheetChoices(scope.orgId);

  return (
    <div className="space-y-6">
      <PageHeader help="products" title="Add many at once" description="One sheet and a folder of photos" />
      <BulkProductWizard orgId={scope.orgId} choices={choices} />
    </div>
  );
}
