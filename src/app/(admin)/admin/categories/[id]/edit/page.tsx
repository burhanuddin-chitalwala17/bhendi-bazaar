/**
 * Edit a category — a server component ([ADR-0034]).
 *
 * Was a client page that fetched the category on mount and rendered a spinner over it. Both
 * reads — the category and the parent picker's options — happen here, and a missing row is a
 * 404 rather than a hand-rolled "not found" panel.
 */
import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/category/category-form";
import { PageShell } from "@/components/shared/page-shell";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [category, { categories }] = await Promise.all([
    adminCategoriesDAL.getCategoryById(id),
    adminCategoriesDAL.getCategories(),
  ]);

  if (!category) notFound();

  return (
    <PageShell width="form">
      <CategoryForm category={category} parentOptions={categories} isEdit />
    </PageShell>
  );
}
