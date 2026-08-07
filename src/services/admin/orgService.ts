// src/services/admin/orgService.ts

import type { OrgWithStats, Org } from "@/domain/org";
import type { CreateOrgInput } from "@/lib/validation/schemas/org.schema";

export class OrgService {
  private baseUrl = "/api/admin/orgs";

  async getOrgs(includeStats = false): Promise<OrgWithStats[]> {
    const url = includeStats ? `${this.baseUrl}?includeStats=true` : this.baseUrl;
    const response = await fetch(url);
    
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

  async createOrg(data: CreateOrgInput): Promise<Org> {
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

  async updateOrg(id: string, data: Partial<CreateOrgInput>): Promise<Org> {
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