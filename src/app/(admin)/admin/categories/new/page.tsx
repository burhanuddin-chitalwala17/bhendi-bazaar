/**
 * Create a category — a server component ([ADR-0034]).
 *
 * The parent picker's options are read here and handed to the form, so the page does not
 * render an empty select and then fill it in.
 */
import { CategoryForm } from "@/components/category/category-form";
import { PageShell } from "@/components/shared/page-shell";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";

export default async function NewCategoryPage() {
  const { categories } = await adminCategoriesDAL.getCategories();

  return (
    <PageShell width="form">
      <CategoryForm parentOptions={categories} />
    </PageShell>
  );
}
