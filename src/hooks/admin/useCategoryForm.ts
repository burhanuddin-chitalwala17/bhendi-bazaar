// hooks/admin/useCategoryForm.ts

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminCategoryApiClient } from "@/services/admin/categoryApiClient";
import type {
  AdminCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/domain/admin";

interface UseCategoryFormOptions {
  category?: AdminCategory;
  isEdit: boolean;
  onClearDraft?: () => void;
}

export function useCategoryForm({
  category,
  isEdit,
  onClearDraft,
}: UseCategoryFormOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const submitCategory = async (data: CreateCategoryInput) => {
    // Additional validation
    if (!data.heroImage) {
      throw new Error("Please upload a hero image");
    }

    setError(null);
    setSuccessMessage(null);

    try {
      if (isEdit && category) {
        // Update existing category
        await adminCategoryApiClient.updateCategory(
          category.id,
          data as UpdateCategoryInput
        );
        setSuccessMessage("Category updated successfully!");
      } else {
        // Create new category
        await adminCategoryApiClient.createCategory(data);
        setSuccessMessage("Category created successfully!");
        // Clear the saved draft after successful creation
        onClearDraft?.();
      }

      // Navigate back to categories list
      setTimeout(() => {
        router.push(returnUrl || "/admin/categories");
      }, 500);
    } catch (err) {
      // Presentation belongs to useServerForm; rethrow so field details survive.
      throw err;
    }
  };

  return {
    submitCategory,
    error,
    successMessage,
    setError,
  };
}

