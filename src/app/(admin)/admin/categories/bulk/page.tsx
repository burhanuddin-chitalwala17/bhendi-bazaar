import { requirePlatformAdmin } from "@/lib/admin-auth";
import { BulkCategoryWizard } from "@/components/bulk-upload/BulkCategoryWizard";
import { PageHeader, PageShell } from "@/components/shared/page-shell";

export const metadata = { robots: { index: false, follow: false } };

export default async function BulkCategoriesPage() {
  await requirePlatformAdmin();
  return (
    <PageShell width="form">
      <PageHeader title="Bulk upload categories" description="One sheet, with hero images alongside." />
      <BulkCategoryWizard />
    </PageShell>
  );
}
