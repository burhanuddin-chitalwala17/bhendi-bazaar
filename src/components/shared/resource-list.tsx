"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { EmptyState, type EmptyStateProps } from "@/components/shared/states/EmptyState";
import { ErrorState, type ErrorStateProps } from "@/components/shared/states/ErrorState";
import { SkeletonRows } from "@/components/shared/states/skeletons";
import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS } from "@/types/shared";
import { RESOURCE_LIST_COPY } from "./shared-copy";

/** Where a column sits in a phone row. Unplaced columns show as a label and value under the title. */
export type PhoneSlot = "title" | "meta" | "status" | "trailing" | "hidden";

export interface ResourceColumn<T> {
  key: string;
  label: string;
  cell: (row: T) => ReactNode;
  /** Sortable on the server by `key`; the order lives in the URL, never in memory. */
  sortable?: boolean;
  align?: "start" | "end";
  phone?: PhoneSlot;
}

export type SortOrder = "asc" | "desc";

export interface ResourceSelection {
  selected: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
}

export interface ResourceListProps<T> {
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  columns: readonly ResourceColumn<T>[];
  /** What the rows are, for assistive technology: "Products". */
  label: string;
  /** The row's picture: leads the phone row and the table's title cell. */
  thumbnail?: (row: T) => ReactNode;
  /** The whole row opens this. */
  rowHref?: (row: T) => string;
  /** The table's row opens this instead, e.g. a side panel beside the list from desktop. */
  tableRowHref?: (row: T) => string;
  /** The row the screen is showing beside the list: marked, and announced as current. */
  activeKey?: string;
  /** Checkboxes, when the screen has something to do with several rows at once (SelectionBar). */
  selection?: ResourceSelection;
  /** Spoken name of a row's checkbox; defaults to its key. */
  rowLabel?: (row: T) => string;
  state?: "ready" | "loading" | "error";
  empty?: Pick<EmptyStateProps, "title" | "description" | "action">;
  error?: Pick<ErrorStateProps, "title" | "description" | "onRetry" | "action">;
  /** URL parameter names the page reads its sort from. */
  sortParams?: { by: string; order: string };
  /** The form factor the table takes over from the rows. */
  tableFrom?: "md" | "lg";
  /** Below the rows and kept through loading and empty, e.g. `ListPagination`. */
  footer?: ReactNode;
  className?: string;
}

const FROM = {
  md: { rows: "md:hidden", table: "hidden md:block" },
  lg: { rows: "lg:hidden", table: "hidden lg:block" },
} as const;

const DEFAULT_SORT_PARAMS = { by: "sortBy", order: "sortOrder" };

/**
 * One list, two shapes: rows on a phone (picture, title, a meta line, status) and a dense table
 * from a tablet, built from the same column definitions so the two can never disagree.
 */
export function ResourceList<T>({
  rows,
  rowKey,
  columns,
  label,
  thumbnail,
  rowHref,
  tableRowHref,
  activeKey,
  selection,
  rowLabel,
  state = "ready",
  empty = { title: RESOURCE_LIST_COPY.emptyTitle, description: RESOURCE_LIST_COPY.emptyBody },
  error,
  sortParams = DEFAULT_SORT_PARAMS,
  tableFrom = "md",
  footer,
  className,
}: ResourceListProps<T>) {
  const sort = useUrlSort(sortParams);
  const keys = rows.map((row, i) => rowKey(row, i));
  const speak = (row: T, i: number) => rowLabel?.(row) ?? keys[i];

  const body =
    state === "loading" ? (
      <div role="status" aria-label={`Loading ${label.toLowerCase()}`}>
        <SkeletonRows count={4} thumbnail={Boolean(thumbnail)} className="rounded-none border-0" />
      </div>
    ) : state === "error" ? (
      <ErrorState className="px-4" description={RESOURCE_LIST_COPY.theListDidnTLoad} {...error} />
    ) : rows.length === 0 ? (
      <EmptyState className="px-4" {...empty} />
    ) : (
      <>
        <PhoneRows {...{ rows, keys, columns, label, thumbnail, rowHref, selection, speak }} className={FROM[tableFrom].rows} />
        <Table
          {...{ rows, keys, columns, label, thumbnail, selection, speak, sort, activeKey }}
          rowHref={tableRowHref ?? rowHref}
          stay={tableRowHref !== undefined}
          className={FROM[tableFrom].table}
        />
      </>
    );

  return (
    <div className={cn("overflow-hidden rounded-card border border-border bg-card", className)}>
      {body}
      {footer}
    </div>
  );
}

interface PartProps<T> {
  rows: readonly T[];
  keys: string[];
  columns: readonly ResourceColumn<T>[];
  label: string;
  thumbnail?: (row: T) => ReactNode;
  rowHref?: (row: T) => string;
  selection?: ResourceSelection;
  speak: (row: T, index: number) => string;
  className: string;
}

function toggle(selection: ResourceSelection, key: string) {
  const next = new Set(selection.selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selection.onChange(next);
}

/** A link stretched over its row, so the whole row opens it while the checkbox stays its own target. */
function RowLink({ href, stay, children }: { href?: string; stay?: boolean; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} prefetch={false} scroll={stay ? false : undefined} className="after:absolute after:inset-0 hover:underline">
      {children}
    </Link>
  );
}

function PhoneRows<T>({ rows, keys, columns, label, thumbnail, rowHref, selection, speak, className }: PartProps<T>) {
  const title = columns.find((c) => c.phone === "title") ?? columns[0];
  const meta = columns.filter((c) => c.phone === "meta");
  const status = columns.filter((c) => c.phone === "status");
  const trailing = columns.filter((c) => c.phone === "trailing");
  const rest = columns.filter((c) => c !== title && c.phone === undefined);

  return (
    <ul aria-label={label} className={cn("divide-y divide-border", className)}>
      {rows.map((row, i) => (
        <li key={keys[i]} className="relative flex items-center gap-3 px-4 py-3">
          {selection && (
            <div className="relative z-10">
              <Checkbox
                hideLabel
                label={`Select ${speak(row, i)}`}
                checked={selection.selected.has(keys[i])}
                onChange={() => toggle(selection, keys[i])}
              />
            </div>
          )}
          {thumbnail && <div className="shrink-0">{thumbnail(row)}</div>}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="truncate text-small font-semibold text-foreground">
              <RowLink href={rowHref?.(row)}>{title.cell(row)}</RowLink>
            </div>
            {meta.length > 0 && (
              <p className="truncate text-caption tabular-nums text-muted-foreground">
                {meta.map((c, j) => (
                  <span key={c.key}>
                    {j > 0 && " · "}
                    {c.cell(row)}
                  </span>
                ))}
              </p>
            )}
            {rest.length > 0 && (
              <dl className="space-y-0.5 text-caption">
                {rest.map((c) => (
                  <div key={c.key} className="flex gap-1">
                    <dt className="text-muted-foreground">{c.label}</dt>
                    <dd className="min-w-0 text-foreground">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {status.map((c) => (
            <div key={c.key} className="shrink-0">
              {c.cell(row)}
            </div>
          ))}
          {trailing.map((c) => (
            <div key={c.key} className="relative z-10 shrink-0">
              {c.cell(row)}
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Table<T>({
  rows,
  keys,
  columns,
  label,
  thumbnail,
  rowHref,
  selection,
  speak,
  sort,
  activeKey,
  stay,
  className,
}: PartProps<T> & { sort: UrlSort; activeKey?: string; stay?: boolean }) {
  const allSelected = selection !== undefined && keys.length > 0 && keys.every((k) => selection.selected.has(k));
  const [first] = columns;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-small">
        <caption className="sr-only">{label}</caption>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {selection && (
              <th scope="col" className="w-12 px-4">
                <Checkbox
                  hideLabel
                  label={allSelected ? RESOURCE_LIST_COPY.clearSelection : RESOURCE_LIST_COPY.selectAll}
                  checked={allSelected}
                  onChange={() => selection.onChange(allSelected ? new Set() : new Set(keys))}
                />
              </th>
            )}
            {columns.map((column) => {
              const active = sort.by === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? (active ? (sort.order === "asc" ? "ascending" : "descending") : "none") : undefined}
                  className={cn(
                    "whitespace-nowrap px-4 py-2 text-caption font-medium text-muted-foreground",
                    column.align === "end" ? "text-right" : "text-left",
                  )}
                >
                  {column.sortable ? (
                    <Link
                      href={sort.hrefFor(column.key)}
                      prefetch={false}
                      scroll={false}
                      className="-mx-1 inline-flex min-h-10 items-center gap-1 rounded-field px-1 hover:text-foreground"
                    >
                      {column.label}
                      {active && <Icon name={sort.order === "asc" ? "collapse" : "expand"} size="xs" />}
                    </Link>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr
              key={keys[i]}
              aria-selected={selection ? selection.selected.has(keys[i]) : undefined}
              aria-current={activeKey === keys[i] ? "true" : undefined}
              className={cn("relative hover:bg-muted/60 aria-selected:bg-primary/5", activeKey === keys[i] && "bg-primary/5")}
            >
              {selection && (
                <td className="relative z-10 px-4">
                  <Checkbox
                    hideLabel
                    label={`Select ${speak(row, i)}`}
                    checked={selection.selected.has(keys[i])}
                    onChange={() => toggle(selection, keys[i])}
                  />
                </td>
              )}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap px-4 py-3",
                    column.align === "end" && "text-right tabular-nums",
                    column.phone === "trailing" && "relative z-10",
                  )}
                >
                  {column === first ? (
                    <div className="flex items-center gap-3">
                      {thumbnail?.(row)}
                      <span className="font-semibold text-foreground">
                        <RowLink href={rowHref?.(row)} stay={stay}>{column.cell(row)}</RowLink>
                      </span>
                    </div>
                  ) : (
                    column.cell(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface UrlSort {
  by: string | null;
  order: SortOrder;
  hrefFor: (key: string) => string;
}

/** The sort as the URL states it; a header is a link to the next sort, which starts at page one. */
export function useUrlSort(params: { by: string; order: string }): UrlSort {
  const pathname = usePathname();
  const search = useSearchParams();
  const by = search.get(params.by);
  const order: SortOrder = search.get(params.order) === "desc" ? "desc" : "asc";
  return {
    by,
    order,
    hrefFor: (key) => {
      const next = new URLSearchParams(search.toString());
      next.set(params.by, key);
      next.set(params.order, by === key && order === "asc" ? "desc" : "asc");
      next.delete("page");
      return `${pathname}?${next.toString()}`;
    },
  };
}

/** Rows per page and prev/next. Server-side paging: the caller navigates, it never slices. */
export function ListPagination({
  page,
  totalPages,
  total,
  shown,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  shown: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pageSizeId = useId();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
      <div className="flex items-center gap-2">
        <label htmlFor={pageSizeId} className="text-small text-muted-foreground">
          {RESOURCE_LIST_COPY.rows}
        </label>
        <div className="w-24">
          <Select id={pageSizeId} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="text-small text-muted-foreground">
        Page {page} of {Math.max(totalPages, 1)}
        <span className="hidden md:inline"> · {shown} of {total}</span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          shape="icon"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={RESOURCE_LIST_COPY.previousPage}
        >
          <Icon name="previous" />
        </Button>
        <Button
          variant="outline"
          shape="icon"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={RESOURCE_LIST_COPY.nextPage}
        >
          <Icon name="next" />
        </Button>
      </div>
    </div>
  );
}
