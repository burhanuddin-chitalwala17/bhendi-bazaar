// src/components/admin/orgsContainer/hooks/useOrgs.ts

import { useState, useEffect, useCallback } from "react";
import { orgService } from "@/services/admin/orgService";
import type { OrgWithStats, CreateOrgInput } from "@/domain/org";
import { toast } from "sonner";

export function useOrgs() {
  const [orgs, setOrgs] = useState<OrgWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orgService.getOrgs(true); // with stats
      setOrgs(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Failed to load orgs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const createOrg = async (data: CreateOrgInput) => {
    try {
      const newOrg = await orgService.createOrg(data);
      toast.success("Organisation created successfully");
      setOrgs([...orgs, newOrg as OrgWithStats]);
    } catch (err) {
      // Presentation belongs to useServerForm; rethrow so field details survive.
      throw err;
    }
  };

  const updateOrg = async (id: string, data: Partial<CreateOrgInput>) => {
    try {
      const newOrg = (await orgService.updateOrg(
        id,
        data
      )) as OrgWithStats;
      toast.success("Organisation updated successfully");
      setOrgs(
        orgs.map((org: OrgWithStats) =>
          org.id === id ? newOrg : org
        )
      );
    } catch (err) {
      // Presentation belongs to useServerForm; rethrow so field details survive.
      throw err;
    }
  };

  const deleteOrg = async (id: string) => {
    try {
      await orgService.deleteOrg(id);
      toast.success("Organisation deleted successfully");
      setOrgs(orgs.filter((org: OrgWithStats) => org.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete org");
      throw err;
    }
  };

  return {
    orgs,
    loading,
    error,
    createOrg,
    updateOrg,
    deleteOrg,
    refetch: loadOrgs,
  };
}