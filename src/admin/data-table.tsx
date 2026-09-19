/**
 * Data Table Component
 * Generic table component with pagination and sorting
 */

"use client";

import { useId, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/types/shared";

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
  /** Rows per page. Server-side — the caller refetches, it never slices locally. */
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSort?: (key: string, order: "asc" | "desc") => void;
  isLoading?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  totalPages,
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSort,
  isLoading,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const pageSizeId = useId();

  const handleSort = (key: string) => {
    const newOrder = sortKey === key && sortOrder === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortOrder(newOrder);
    onSort?.(key, newOrder);
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* The footer stays mounted through loading and empty results — it carries the
          page-size control, and a control that disappears cannot undo the filter
          that emptied the table. */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : data.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">No data found</p>
      ) : (
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort(column.key)}
                        className="-mx-2 h-auto gap-1 px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      >
                        {column.label}
                        {sortKey === column.key &&
                          (sortOrder === "asc" ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          ))}
                      </Button>
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
      )}

      {/* Pagination — wraps below sm; the parent is overflow-hidden, so anything that
          cannot wrap gets clipped, taking the prev/next buttons with it */}
      <div className="bg-background px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 border-t border-border">
        <div className="flex items-center gap-2">
          <label htmlFor={pageSizeId} className="text-sm text-foreground/80">
            Rows
          </label>
          {/* Select is `w-full`; the wrapper is what sizes it. */}
          <div className="w-24">
            <Select
              id={pageSizeId}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              disabled={isLoading}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="text-sm text-foreground/80">
          Page {currentPage} of {totalPages}
        </div>
        <div className="hidden text-sm text-foreground/80 sm:block">
          Showing {data.length} of {totalItems} row(s)
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={isLoading || currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={isLoading || currentPage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
