"use client";

import { useState } from "react";
import { OrgsTable } from "./components/OrgsTable";
import { AddOrgModal } from "./components/AddOrgModal";
import { useOrgs } from "./hooks/useOrgs";
import type { OrgWithStats } from "@/domain/org";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import type { OrgListFilters } from "./orgApiClient";
import { DEFAULT_PAGE_SIZE } from "@server/shared/pagination";

import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ORG_CONSOLE_COPY } from "./org-console-copy";

export function OrgsContainer() {
  const [filters, setFilters] = useState<OrgListFilters>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    status: "all",
  });

  const {
    orgs,
    pagination,
    loading,
    error,
    createOrg,
    updateOrg,
    blockOrg,
    unblockOrg,
    refetch,
  } = useOrgs(filters);

  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrgWithStats | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">(
    "create",
  );

  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm.trim() || undefined, page: 1 });
  };

  const handleView = (org: OrgWithStats) => {
    setEditingOrg(org);
    setModalMode("view");
    setShowModal(true);
  };

  const handleStatusFilterChange = (value: OrgListFilters["status"]) => {
    setFilters({ ...filters, status: value, page: 1 });
  };

  const handleCreate = async (data: OrgFormInput) => {
    setModalMode("create");
    setIsSubmitting(true);
    try {
      await createOrg(data);
      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (org: OrgWithStats) => {
    setEditingOrg(org);
    setModalMode("edit");
    setShowModal(true);
  };

  const handleUpdate = async (data: OrgFormInput) => {
    if (!editingOrg) return;

    setIsSubmitting(true);
    try {
      await updateOrg(editingOrg.id, data);
      setShowModal(false);
      setEditingOrg(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrg(null);
    setModalMode("create");
  };

  const handleToggleBlock = async (org: OrgWithStats) => {
    if (org.isBlocked) {
      await unblockOrg(org.id);
    } else {
      await blockOrg(org.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={ORG_CONSOLE_COPY.title}
        description={ORG_CONSOLE_COPY.count(pagination.total)}
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()} pending={loading}>
              <Icon name="refresh" />
              {ORG_CONSOLE_COPY.refresh}
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setModalMode("create");
                setEditingOrg(null);
                setShowModal(true);
              }}
            >
              <Icon name="add" />
              {ORG_CONSOLE_COPY.add}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="rounded-card border border-border bg-card p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="w-full min-w-0 grow sm:w-auto sm:min-w-64">
            <div className="flex gap-2">
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={ORG_CONSOLE_COPY.searchPlaceholder}
                aria-label={ORG_CONSOLE_COPY.searchLabel}
                className="flex-1"
              />
              <Button
                variant="default"
                onClick={handleSearch}
              >
                <Icon name="search" />
                {ORG_CONSOLE_COPY.search}
              </Button>
            </div>
          </div>

          {/* Status Filter */}
          <Select
            value={filters.status}
            onChange={(e) =>
              handleStatusFilterChange(
                e.target.value as OrgListFilters["status"],
              )
            }
          >
            <option value="all">{ORG_CONSOLE_COPY.allStatuses}</option>
            <option value="active">{ORG_CONSOLE_COPY.active}</option>
            <option value="inactive">{ORG_CONSOLE_COPY.inactive}</option>
          </Select>
        </div>
      </div>

      {error && (
        <ErrorState
          title={ORG_CONSOLE_COPY.failed}
          description={error}
          onRetry={() => void refetch()}
        />
      )}

      {/* Table — rendered even when empty, so the filters that emptied it stay usable */}
      <OrgsTable
        orgs={orgs}
        pagination={pagination}
        isLoading={loading}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onPageSizeChange={(limit) => setFilters({ ...filters, limit, page: 1 })}
        onView={handleView}
        onEdit={handleEdit}
        onToggleBlock={handleToggleBlock}
      />

      <AddOrgModal
        open={showModal}
        onClose={handleCloseModal}
        onSubmit={editingOrg ? handleUpdate : handleCreate}
        org={editingOrg || undefined}
        isSubmitting={isSubmitting}
        mode={modalMode}
      />
    </div>
  );
}
