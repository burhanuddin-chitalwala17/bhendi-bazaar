import { readApiError } from "@/lib/api-error";
import type {
  ContactMessageFilters,
  ContactMessageListResult,
  ContactMessageStatus,
} from "@/domain/support";

/** The admin inbox's only two calls. Errors keep the server's message (ADR-0013). */
class AdminContactApiClient {
  async getMessages(
    filters: ContactMessageFilters = {}
  ): Promise<ContactMessageListResult> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

    const response = await fetch(`/api/admin/contact?${params.toString()}`);
    if (!response.ok) throw await readApiError(response);

    return response.json();
  }

  async setStatus(id: string, status: ContactMessageStatus): Promise<void> {
    const response = await fetch(`/api/admin/contact/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw await readApiError(response);
  }
}

export const adminContactApiClient = new AdminContactApiClient();
