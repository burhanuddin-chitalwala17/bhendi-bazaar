"use client";

import type { ReactNode } from "react";

import { ListPagination, ResourceList, type PhoneSlot } from "@/components/shared/resource-list";

/**
 * The admin tables' older column shape, kept as a thin wrapper over `ResourceList` so its call
 * sites moved without a rewrite. New lists use `ResourceList` directly.
 */
export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  phone?: PhoneSlot;
}

interface DataTableProps<T> {
  data: readonly T[];
  columns: readonly Column<T>[];
  /** What the rows are, for assistive technology. */
  label?: string;
  totalPages: number;
  currentPage: number;
  totalItems: number;
  /** Rows per page. Server-side — the caller refetches, it never slices locally. */
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** URL parameter names the page reads its sort from; sorting is a link, not a callback. */
  sortParams?: { by: string; order: string };
  isLoading?: boolean;
}

function idOf(item: object, index: number): string {
  return "id" in item && (typeof item.id === "string" || typeof item.id === "number") ? String(item.id) : String(index);
}

export function DataTable<T extends object>({
  data,
  columns,
  label = "Rows",
  totalPages,
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortParams,
  isLoading,
}: DataTableProps<T>) {
  return (
    <ResourceList
      rows={data}
      rowKey={idOf}
      label={label}
      state={isLoading ? "loading" : "ready"}
      sortParams={sortParams}
      columns={columns.map((column) => ({
        key: column.key,
        label: column.label,
        sortable: column.sortable,
        phone: column.phone,
        cell: column.render ?? ((item: T) => String((item as Record<string, unknown>)[column.key] ?? "")),
      }))}
      // The footer stays through loading and empty: it carries the page-size control, and a
      // control that disappears cannot undo the filter that emptied the table.
      footer={
        <ListPagination
          page={currentPage}
          totalPages={totalPages}
          total={totalItems}
          shown={data.length}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      }
    />
  );
}
