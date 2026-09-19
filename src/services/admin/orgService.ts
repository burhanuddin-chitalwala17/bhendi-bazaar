// src/services/admin/orgService.ts

import type { OrgWithStats, Org } from "@/domain/org";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import type { Pagination } from "@/types/shared";

export interface OrgListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | "active" | "inactive";
}

export interface OrgListResult {
  orgs: OrgWithStats[];
  pagination: Pagination;
}

export class OrgService {
  private baseUrl = "/api/admin/orgs";

  async getOrgs(filters: OrgListFilters = {}): Promise<OrgListResult> {
    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.search) params.set("search", filters.search);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    
    if (!response.ok) {
      // ⭐ Check if response has content before parsing
      const text = await response.text();
      let error;
      try {
        error = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }
      throw new Error(error.error || "Failed to fetch orgs");
    }
    
    return response.json();
  }

  async createOrg(data: OrgFormInput): Promise<Org> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      // ⭐ Safe JSON parsing
      const text = await response.text();
      let error;
      try {
        error = JSON.parse(text);
      } catch {
        console.error("Non-JSON error response:", text);
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }
      
      if (error.details) {
        const errorMessages = error.details
          .map((e: any) => `${e.path.join('.')}: ${e.message}`)
          .join('\n');
        throw new Error(errorMessages || error.error);
      }
      
      throw new Error(error.message || error.error || "Failed to create org");
    }
    
    return response.json();
  }

  async updateOrg(id: string, data: Partial<OrgFormInput>): Promise<Org> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const text = await response.text();
      let error;
      try {
        error = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }
      throw new Error(error.error || "Failed to update org");
    }
    
    return response.json();
  }

  async deleteOrg(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      const text = await response.text();
      let error;
      try {
        error = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }
      throw new Error(error.error || "Failed to delete org");
    }
    
    // ⭐ DELETE might return empty body or JSON
    const text = await response.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return; // Empty response is OK for DELETE
      }
    }
  }
}

export const orgService = new OrgService();