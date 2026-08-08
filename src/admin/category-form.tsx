"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useServerForm } from "@/hooks/core/useServerForm";
import { ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useFormPersist } from "@/hooks/forms/useFormPersist";
import { useCategoryForm } from "@/hooks/admin/useCategoryForm";
import { categoryFormSchema } from "@/lib/validation/schemas/category.schema";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import {
  CategoryBasicFields,
  CategoryStylingFields,
  CategoryImageField,
} from "@/components/shared/forms/category";
import { adminCategoryApiClient } from "@/services/admin/categoryApiClient";
import type { AdminCategory, CreateCategoryInput } from "@/domain/admin";

interface CategoryFormProps {
  category?: AdminCategory;
  isEdit?: boolean;
}

export function CategoryForm({ category, isEdit = false }: CategoryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  const [allCategories, setAllCategories] = useState<AdminCategory[]>([]);
  useEffect(() => {
    adminCategoryApiClient
      .getCategories({ limit: 100 })
      .then((result) => setAllCategories(result.categories))
      .catch(() => setAllCategories([])); // options are a convenience; the server re-checks
  }, []);

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
    schema: categoryFormSchema,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={returnUrl || "/admin/categories"}
            className="p-2 hover:bg-muted rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">
              {isEdit ? "Edit Category" : "Create New Category"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEdit
                ? "Update category details"
                : "Add a new category to organize products"}
            </p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {formError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{formError}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* Form Sections - Clean and composable! */}
      <CategoryBasicFields
        register={register}
        errors={errors}
        parentOptions={parentOptions}
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
