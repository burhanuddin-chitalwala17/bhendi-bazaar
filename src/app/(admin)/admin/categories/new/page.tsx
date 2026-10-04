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
  // Both reads happen here rather than in the form: a server component reads, a client
  // component receives ([ADR-0034]).
  const [{ categories }, productTypeOptions] = await Promise.all([
    adminCategoriesDAL.getCategories(),
    adminCategoriesDAL.getProductTypeOptions(),
  ]);

  return (
    <PageShell width="form">
      <CategoryForm parentOptions={categories} productTypeOptions={productTypeOptions} />
    </PageShell>
  );
}
