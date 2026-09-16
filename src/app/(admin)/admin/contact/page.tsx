"use client";

import { useState } from "react";
import { CheckCircle, RotateCcw, Search } from "lucide-react";

import { DataTable, type Column } from "@/admin/data-table";
import { PageHeader } from "@/components/shared/page-shell";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { adminContactApiClient } from "@/services/admin/contactApiClient";
import type { AdminContactMessage, ContactMessageFilters } from "@/domain/support";

/**
 * The inbox for Contact us (docs/specs/contact-us/ R7–R8).
 *
 * Nothing is emailed when a message arrives, so this page is where they are seen. It
 * opens on the unresolved ones, because "what is still open" is the question it exists
 * to answer.
 */
export default function AdminContactPage() {
  const [filters, setFilters] = useState<ContactMessageFilters>({
    status: "NEW",
    page: 1,
    limit: 20,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const { data, loading, refetch } = useAsyncData(
    () => adminContactApiClient.getMessages(filters),
    { refetchDependencies: [filters] }
  );

  const { messages = [], totalPages = 1, total = 0 } = data ?? {};

  const { mutate: setStatus } = useMutation(
    ({ id, resolved }: { id: string; resolved: boolean }) =>
      adminContactApiClient.setStatus(id, resolved ? "RESOLVED" : "NEW"),
    { successMessage: "Message updated", onSuccess: () => refetch() }
  );

  const columns: Column<AdminContactMessage>[] = [
    {
      key: "name",
      label: "From",
      render: (message) => (
        <div className="space-y-0.5">
          <p className="font-medium">{message.name}</p>
          <a
            href={`mailto:${message.email}?subject=${encodeURIComponent(
              `Re: ${message.subject || "your message to Bhendi Bazaar"}`
            )}`}
            className="block text-xs text-primary hover:underline"
          >
            {message.email}
          </a>
          <p className="text-2xs uppercase tracking-label text-muted-foreground">
            {message.userId ? "Signed in" : "Guest"}
          </p>
        </div>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      render: (message) => (
        <p className="text-sm">
          {message.subject || <span className="text-muted-foreground">—</span>}
        </p>
      ),
    },
    {
      key: "message",
      label: "Message",
      render: (message) => (
        <p className="max-h-24 max-w-md overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
          {message.message}
        </p>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (message) => (
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            message.status === "RESOLVED"
              ? "bg-success/15 text-success"
              : "bg-warning/15 text-warning"
          }`}
        >
          {message.status === "RESOLVED" ? "Resolved" : "Open"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Received",
      sortable: true,
      render: (message) => new Date(message.createdAt).toLocaleString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (message) => {
        const resolved = message.status === "RESOLVED";
        return (
          <button
            type="button"
            onClick={() => setStatus({ id: message.id, resolved: !resolved })}
            title={resolved ? "Reopen" : "Mark resolved"}
            className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
              resolved
                ? "text-warning hover:bg-warning/10"
                : "text-success hover:bg-success/10"
            }`}
          >
            {resolved ? (
              <RotateCcw className="size-4" />
            ) : (
              <CheckCircle className="size-4" />
            )}
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact"
        description="Messages sent through Contact us on the storefront"
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-full min-w-0 grow sm:w-auto sm:min-w-64">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  setFilters({ ...filters, search: searchTerm, page: 1 })
                }
                placeholder="Search name, email, subject or message…"
                className="h-10 flex-1 rounded-lg border border-input px-4 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setFilters({ ...filters, search: searchTerm, page: 1 })}
                className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground hover:bg-primary/90"
              >
                <Search className="size-4" />
                Search
              </button>
            </div>
          </div>

          <select
            value={filters.status ?? "all"}
            onChange={(event) =>
              setFilters({
                ...filters,
                status:
                  event.target.value === "all"
                    ? undefined
                    : (event.target.value as "NEW" | "RESOLVED"),
                page: 1,
              })
            }
            className="h-10 rounded-lg border border-input px-4 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="NEW">Open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="all">All messages</option>
          </select>
        </div>
      </div>

      <DataTable
        data={messages}
        columns={columns}
        totalPages={totalPages}
        currentPage={filters.page ?? 1}
        totalItems={total}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onSort={(key, order) =>
          setFilters({
            ...filters,
            sortBy: key === "status" ? "status" : "createdAt",
            sortOrder: order,
          })
        }
        isLoading={loading}
      />
    </div>
  );
}
