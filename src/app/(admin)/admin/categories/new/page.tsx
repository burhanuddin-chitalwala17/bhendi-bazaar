/**
 * Admin New Category Page
 * Create a new category
 */

import { CategoryForm } from "@/admin/category-form";

import { PageShell } from "@/components/shared/page-shell";
export default function NewCategoryPage() {
  return (
    <PageShell width="form">
      <CategoryForm />
    </PageShell>
  );
}

