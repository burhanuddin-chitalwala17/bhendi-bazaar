import { requirePlatformAdmin } from "@/lib/admin-auth";
import { BulkCategoryWizard } from "@/components/bulk-upload/BulkCategoryWizard";

export const metadata = { robots: { index: false, follow: false } };

export default async function BulkCategoriesPage() {
  await requirePlatformAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk upload categories</h1>
        <p className="text-muted-foreground">One sheet, hero images alongside</p>
      </div>
      <BulkCategoryWizard />
    </div>
  );
}
