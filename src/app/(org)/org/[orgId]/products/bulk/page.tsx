import { requireOrgMember } from "@/lib/org-auth";
import { BulkProductWizard } from "@/components/bulk-upload/BulkProductWizard";

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
      <div>
        <h1 className="text-3xl font-bold">Bulk upload</h1>
        <p className="text-muted-foreground">
          Create your catalogue from one sheet and a folder of photos
        </p>
      </div>
      <BulkProductWizard orgId={scope.orgId} />
    </div>
  );
}
