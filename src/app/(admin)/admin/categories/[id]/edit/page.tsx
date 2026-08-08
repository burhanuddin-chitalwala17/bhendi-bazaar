/**
 * Admin Edit Category Page
 * Edit an existing category
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CategoryForm } from "@/admin/category-form";
import { adminCategoryApiClient } from "@/services/admin/categoryApiClient";
import type { AdminCategory } from "@/domain/admin";

export default function EditCategoryPage() {
  const params = useParams();
  const categoryId = params.id as string;
  const [category, setCategory] = useState<AdminCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategory();
  }, [categoryId]);

  const loadCategory = async () => {
    try {
      setIsLoading(true);
      const data = await adminCategoryApiClient.getCategoryById(categoryId);
      setCategory(data);
    } catch (err) {
      console.error("Failed to load category:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load category"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Category Not Found
          </h2>
          <p className="text-muted-foreground">
            {error || "The category could not be found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <CategoryForm category={category} isEdit />
    </div>
  );
}

