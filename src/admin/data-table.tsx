/**
 * Data Table Component
 * Generic table component with pagination and sorting
 */

"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onSort?: (key: string, order: "asc" | "desc") => void;
  isLoading?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  totalPages,
  currentPage,
  totalItems,
  onPageChange,
  onSort,
  isLoading,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    const newOrder = sortKey === key && sortOrder === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortOrder(newOrder);
    onSort?.(key, newOrder);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8">
        <p className="text-center text-muted-foreground">No data found</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background border-b border-border">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      {column.label}
                      {sortKey === column.key &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        ))}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item, index) => (
              <tr key={index} className="hover:bg-muted/60">
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                    {column.render ? column.render(item) : item[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-background px-6 py-3 flex items-center justify-between border-t border-border">
        <div className="text-sm text-foreground/80">
          Page {currentPage} of {totalPages}
        </div>
        <div className="text-sm text-foreground/80">
          Showing {data.length} of {totalItems} product(s)
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-input rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-input rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


