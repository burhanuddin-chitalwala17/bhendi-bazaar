/**
 * Admin Categories Page
 * Manage categories with CRUD operations
 */

"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { useState } from "react";
import { DataTable, Column } from "@/admin/data-table";
import { Search, Plus, Edit, Trash2, MoveUp, MoveDown } from "lucide-react";
import Link from "next/link";
import { adminCategoryApiClient } from "@/services/admin/categoryApiClient";
import type { AdminCategory, CategoryListFilters } from "@/domain/admin";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminCategoriesPage() {
  const [filters, setFilters] = useState<CategoryListFilters>({
    page: 1,
    limit: 50,
    sortBy: "order",
    sortOrder: "asc",
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Use new hooks
  const {
    data,
    loading: isLoading,
    error,
    refetch,
  } = useAsyncData(() => adminCategoryApiClient.getCategories(filters), {
    refetchDependencies: [filters],
  });

  // Mutations
  const { mutate: deleteCategory, isLoading: isDeleting } = useMutation(
    adminCategoryApiClient.deleteCategory,
    {
      successMessage: "Category deleted successfully!",
      onSuccess: () => refetch(),
    }
  );

  const { mutate: updateCategory, isLoading: isUpdating } = useMutation(
    ({ id, order }: { id: string; order: number }) =>
      adminCategoryApiClient.updateCategory(id, { order }),
    {
      onSuccess: () => refetch(),
    }
  );

  // Extract data
  const categories = data?.categories || [];
  const totalPages = data?.totalPages || 1;

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm, page: 1 });
  };

  const handleDelete = (categoryId: string, categoryName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${categoryName}"? This will also affect products in this category.`
      )
    ) {
      return;
    }
    deleteCategory(categoryId).then(() =>
      toast.success("Category deleted successfully!")
    );
  };

  const handleReorder = (
    categoryId: string,
    currentOrder: number,
    direction: "up" | "down"
  ) => {
    const newOrder = direction === "up" ? currentOrder - 1 : currentOrder + 1;
    updateCategory({ id: categoryId, order: newOrder }).then(() =>
      toast.success("Category reordered successfully!")
    );
  };

  const columns: Column<AdminCategory>[] = [
    {
      key: "order",
      label: "Order",
      sortable: true,
      render: (category) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-600">
            {category.order}
          </span>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleReorder(category.id, category.order, "up")}
              disabled={category.order === 0 || isUpdating}
              className={cn(
                "p-0.5 text-gray-400 hover:text-gray-600",
                isUpdating && "opacity-50 cursor-not-allowed"
              )}
              title="Move up"
            >
              <MoveUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleReorder(category.id, category.order, "down")}
              disabled={isUpdating}
              className={cn(
                "p-0.5 text-gray-400 hover:text-gray-600",
                isUpdating && "opacity-50 cursor-not-allowed"
              )}
              title="Move down"
            >
              <MoveDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "name",
      label: "Category",
      sortable: true,
      render: (category) => (
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-lg ${category.accentColorClass} border border-gray-200 flex items-center justify-center`}
          >
            <span className="text-xs font-medium text-gray-700">
              {category.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium">{category.name}</p>
            <p className="text-sm text-gray-500">/{category.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (category) => (
        <p className="text-sm text-gray-600 max-w-md truncate">
          {category.description}
        </p>
      ),
    },
    {
      key: "productsCount",
      label: "Products",
      render: (category) => (
        <span className="font-semibold text-gray-900">
          {category.productsCount || 0}
        </span>
      ),
    },
    {
      key: "heroImage",
      label: "Hero Image",
      render: (category) => (
        <img
          src={category.heroImage}
          alt={category.name}
          className="w-16 h-10 object-cover rounded"
        />
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (category) => new Date(category.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (category) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/categories/${category.id}/edit`}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit category"
          >
            <Edit className="w-4 h-4" />
          </Link>
          <button
            onClick={() => handleDelete(category.id, category.name)}
            disabled={isDeleting}
            className={cn(
              "p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors",
              isDeleting && "opacity-50 cursor-not-allowed"
            )}
            title="Delete category"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gray-900">
            Categories
          </h1>
          <p className="text-gray-600 mt-1">
            Manage product categories and organization
          </p>
        </div>
        <Link
          href="/admin/categories/new"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search categories..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Table */}
      <DataTable
        data={categories}
        columns={columns}
        totalPages={totalPages}
        currentPage={filters.page || 1}
        totalItems={data?.total || 0}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onSort={(key, order) =>
          setFilters({ ...filters, sortBy: key as any, sortOrder: order })
        }
        isLoading={isLoading}
      />
    </div>
  );
}

