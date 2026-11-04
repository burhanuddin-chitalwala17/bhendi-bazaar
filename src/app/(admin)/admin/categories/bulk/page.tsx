import { requirePlatformAdmin } from "@/lib/admin-auth";
import { BulkCategoryWizard } from "@/components/bulk-upload/BulkCategoryWizard";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ADMIN_CATEGORIES_COPY } from "../categories-copy";

export const metadata = { robots: { index: false, follow: false } };

export default async function BulkCategoriesPage() {
  await requirePlatformAdmin();
  return (
    <PageShell width="form">
      <PageHeader title={ADMIN_CATEGORIES_COPY.bulkTitle} description={ADMIN_CATEGORIES_COPY.bulkDescription} />
      <BulkCategoryWizard />
    </PageShell>
  );
}
