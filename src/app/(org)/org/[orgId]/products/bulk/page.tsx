import { requireOrgMember } from "@/lib/org-auth";
import { BulkProductWizard } from "@/components/bulk-upload/BulkProductWizard";
import { SectionHeader } from "@/components/shared/SectionHeader";

export const metadata = { robots: { index: false, follow: false } };

export default async function BulkUploadPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" title="Bulk upload" description="Create your catalogue from one sheet and a folder of photos" />
      <BulkProductWizard orgId={scope.orgId} />
    </div>
  );
}
