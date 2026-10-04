"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useServerForm } from "@/hooks/core/useServerForm";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useFormPersist } from "@/hooks/forms/useFormPersist";
import { useCategoryForm } from "@/hooks/admin/useCategoryForm";
import { categoryFormSchemaFor } from "@/lib/validation/schemas/category.schema";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import {
  CategoryBasicFields,
  CategoryStylingFields,
  CategoryImageField,
} from "@/components/shared/forms/category";
import type { AdminCategory, CreateCategoryInput } from "@/domain/admin";

import { PageHeader } from "@/components/shared/page-shell";
interface CategoryFormProps {
  category?: AdminCategory;
  isEdit?: boolean;
  /**
   * Every category, for the parent picker — read by the page on the server rather than
   * fetched here on mount ([ADR-0034]). The subtree exclusion below is presentation, so it
   * stays; the read is not.
   */
  parentOptions: AdminCategory[];
  /**
   * The product types that exist, read by the page on the server for the same reason as the
   * parents. They are rows now, so the form cannot import them (product-types D6).
   *
   * Required, not optional: the resolver is built from these keys, so a page that forgot to
   * pass them would silently refuse every type a shop chose. A compile error is the right place
   * to find that out.
   */
  productTypeOptions: Array<{ key: string; label: string }>;
}

export function CategoryForm({
  category,
  isEdit = false,
  parentOptions: allCategories,
  productTypeOptions,
}: CategoryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  // A category cannot be its own parent, nor sit under its own subtree — offering
  // those options would invite the exact write the server refuses (TRD D2).
  const parentOptions = useMemo(() => {
    if (!category) return allCategories;
    const excluded = new Set<string>([category.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of allCategories) {
        if (
          candidate.parentId &&
          excluded.has(candidate.parentId) &&
          !excluded.has(candidate.id)
        ) {
          excluded.add(candidate.id);
          grew = true;
        }
      }
    }
    return allCategories.filter((candidate) => !excluded.has(candidate.id));
  }, [allCategories, category]);

  // Initialize react-hook-form
  const form = useServerForm<CreateCategoryInput>({
    schema: categoryFormSchemaFor(productTypeOptions.map((option) => option.key)),
    // Deferred: submitCategory is declared below, after useFormPersist, and is
    // only needed when the form is submitted.
    submit: (data) => submitCategory(data),
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
      heroImage: category?.heroImage || "",
      accent: category?.accent ?? "EMERALD",
      order: category?.order || 0,
      parentId: category?.parentId ?? null,
      productType: category?.productType ?? null,
    },
  });

  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = form;

  // Persist form data (only for new categories, not edits)
  const { clearSaved } = useFormPersist("admin-category-draft", form, {
    enabled: !isEdit,
  });

  // Use the category form hook for business logic
  const { submitCategory, successMessage } = useCategoryForm({
    category,
    isEdit,
    onClearDraft: clearSaved,
  });

  const handleCancel = () => {
    router.push("/admin/categories");
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
      <PageHeader
        back={{
          href: returnUrl || "/admin/categories",
          label: "Back to categories",
        }}
        title={isEdit ? "Edit Category" : "Create New Category"}
        description={
          isEdit
            ? "Update category details"
            : "Add a new category to organize products"
        }
      />

      {/* Error/Success Messages */}
      {formError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{formError}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* Form Sections - Clean and composable! */}
      <CategoryBasicFields
        register={register}
        errors={errors}
        parentOptions={parentOptions}
        watchedProductType={watch("productType")}
        productTypeOptions={productTypeOptions}
      />

      <CategoryStylingFields register={register} watch={watch} />

      <CategoryImageField control={control} errors={errors} />

      {/* Actions */}
      <FormActions
        onCancel={handleCancel}
        submitLabel="Save Category"
        isSubmitting={isSubmitting}
      />
    </form>
  );
}
