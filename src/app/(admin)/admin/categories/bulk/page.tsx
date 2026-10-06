import { requirePlatformAdmin } from "@/lib/admin-auth";
import { BulkCategoryWizard } from "@/components/bulk-upload/BulkCategoryWizard";
import { SectionHeader } from "@/components/shared/SectionHeader";

export const metadata = { robots: { index: false, follow: false } };

export default async function BulkCategoriesPage() {
  await requirePlatformAdmin();
  return (
    <div className="space-y-6">
      <SectionHeader as="h1" title="Bulk upload categories" description="One sheet, hero images alongside" />
      <BulkCategoryWizard />
    </div>
  );
}
