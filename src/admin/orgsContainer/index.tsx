// src/components/admin/orgsContainer/index.tsx

"use client";

import { useState, useMemo } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { OrgsTable } from "./components/OrgsTable";
import { AddOrgModal } from "./components/AddOrgModal";
import { useOrgs } from "./hooks/useOrgs";
import type { OrgWithStats } from "@/domain/org";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";

import { PageHeader } from "@/components/shared/page-shell";
const ITEMS_PER_PAGE = 10;

export function OrgsContainer() {
  const {
    orgs: allOrgs,
    loading,
    error,
    createOrg,
    updateOrg,
    deleteOrg,
    refetch,
  } = useOrgs();

  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrgWithStats | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">(
    "create"
  ); // ⭐ NEW

  // Client-side filters
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Filter and search orgs
  const filteredOrgs = useMemo(() => {
    let filtered = [...allOrgs];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (org) =>
          org.name.toLowerCase().includes(term) ||
          org.code.toLowerCase().includes(term) ||
          org.email.toLowerCase().includes(term) ||
          org.businessName?.toLowerCase().includes(term) ||
          org.gstNumber?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((s) => s.isActive);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((s) => !s.isActive);
    }

    return filtered;
  }, [allOrgs, searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredOrgs.length / ITEMS_PER_PAGE);
  const paginatedOrgs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredOrgs.slice(startIndex, endIndex);
  }, [filteredOrgs, currentPage]);

  // Reset to page 1 when search/filter changes
  const handleSearch = () => {
    setCurrentPage(1);
  };

  // ⭐ NEW: Handle view
  const handleView = (org: OrgWithStats) => {
    setEditingOrg(org);
    setModalMode("view");
    setShowModal(true);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as any);
    setCurrentPage(1);
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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    await deleteOrg(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Orgs Management"
        description={`Manage orgs and vendors on your platform (${filteredOrgs.length} ${filteredOrgs.length === 1 ? "org" : "orgs"})`}
        actions={
          <>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground/80 rounded-lg hover:bg-muted disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => {
              setModalMode("create");
              setEditingOrg(null);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Org
          </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="w-full min-w-0 grow sm:w-auto sm:min-w-64">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by name, code, email, city..."
                className="flex-1 px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredOrgs.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== "all"
              ? "No organisations found matching your filters"
              : "No organisations yet. Add your first one to get started."}
          </p>
        </div>
      )}

      {/* Table */}
      {filteredOrgs.length > 0 && (
        <OrgsTable
          orgs={paginatedOrgs as OrgWithStats[]}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredOrgs.length}
          itemsPerPage={ITEMS_PER_PAGE}
          isLoading={loading}
          onPageChange={setCurrentPage}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
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
