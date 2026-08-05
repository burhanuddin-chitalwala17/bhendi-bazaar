"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useFormPersist } from "@/hooks/forms/useFormPersist";
import { useCategoryForm } from "@/hooks/admin/useCategoryForm";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import {
  CategoryBasicFields,
  CategoryStylingFields,
  CategoryImageField,
} from "@/components/shared/forms/category";
import type { AdminCategory, CreateCategoryInput } from "@/domain/admin";

interface CategoryFormProps {
  category?: AdminCategory;
  isEdit?: boolean;
}

export function CategoryForm({ category, isEdit = false }: CategoryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  // Initialize react-hook-form
  const form = useForm<CreateCategoryInput>({
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
      heroImage: category?.heroImage || "",
      accentColorClass: category?.accentColorClass || "bg-emerald-50",
      order: category?.order || 0,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = form;

  // Persist form data (only for new categories, not edits)
  const { clearSaved } = useFormPersist("admin-category-draft", form, {
    enabled: !isEdit,
  });

  // Use the category form hook for business logic
  const { submitCategory, error, successMessage } = useCategoryForm({
    category,
    isEdit,
    onClearDraft: clearSaved,
  });

  const handleCancel = () => {
    router.push("/admin/categories");
  };

  return (
    <form onSubmit={handleSubmit(submitCategory)} className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={returnUrl || "/admin/categories"}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold text-gray-900">
              {isEdit ? "Edit Category" : "Create New Category"}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEdit
                ? "Update category details"
                : "Add a new category to organize products"}
            </p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* Form Sections - Clean and composable! */}
      <CategoryBasicFields
        register={register}
        errors={errors}
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
