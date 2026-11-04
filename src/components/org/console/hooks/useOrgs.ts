// src/components/admin/orgsContainer/hooks/useOrgs.ts

import { useState, useEffect, useCallback } from "react";
import { orgApiClient, type OrgListFilters } from "@/components/org/console/orgApiClient";
import type { OrgWithStats } from "@/domain/org";
import type { Pagination } from "@/types/shared";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import { toast } from "sonner";
import { DEFAULT_PAGE_SIZE } from "@server/shared/pagination";
import { ORG_CONSOLE_COPY } from "../org-console-copy";
import { ORGS_LOAD_COPY } from "@/components/org/console/org-console-copy";

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

/**
 * The listing is a server page, so every mutation refetches rather than patching the
 * local array — a create or delete changes which rows belong on this page, and only
 * the server knows that.
 */
export function useOrgs(filters: OrgListFilters) {
  const [orgs, setOrgs] = useState<OrgWithStats[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, search, status } = filters;

  const loadOrgs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orgApiClient.getOrgs({ page, limit, search, status });
      setOrgs(data.orgs);
      setPagination(data.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message);
      toast.error(message || ORGS_LOAD_COPY.failed);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const createOrg = async (data: OrgFormInput) => {
    try {
      await orgApiClient.createOrg(data);
      toast.success(ORG_CONSOLE_COPY.created);
      await loadOrgs();
    } catch (err) {
      // Presentation belongs to useServerForm; rethrow so field details survive.
      throw err;
    }
  };

  const updateOrg = async (id: string, data: Partial<OrgFormInput>) => {
    try {
      await orgApiClient.updateOrg(id, data);
      toast.success(ORG_CONSOLE_COPY.updated);
      await loadOrgs();
    } catch (err) {
      // Presentation belongs to useServerForm; rethrow so field details survive.
      throw err;
    }
  };

  const blockOrg = async (id: string) => {
    try {
      await orgApiClient.blockOrg(id);
      toast.success(ORG_CONSOLE_COPY.blocked);
      await loadOrgs();
    } catch (err) {
      toast.error((err instanceof Error && err.message) || ORG_CONSOLE_COPY.blockFailed);
      throw err;
    }
  };

  const unblockOrg = async (id: string) => {
    try {
      await orgApiClient.unblockOrg(id);
      toast.success(ORG_CONSOLE_COPY.unblocked);
      await loadOrgs();
    } catch (err) {
      toast.error((err instanceof Error && err.message) || ORG_CONSOLE_COPY.unblockFailed);
      throw err;
    }
  };

  return {
    orgs,
    pagination,
    loading,
    error,
    createOrg,
    updateOrg,
    blockOrg,
    unblockOrg,
    refetch: loadOrgs,
  };
}
