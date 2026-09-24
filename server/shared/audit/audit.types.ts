/**
 * Admin Activity Log Domain Types
 */

import type { Prisma } from "@prisma/client";

/**
 * What an action records about itself. `Record<string, unknown>` rather than Prisma's
 * `InputJsonValue`: that type requires an index signature, so every caller passing a
 * declared interface (`UpdateCategoryInput`, say) would have to widen it or cast. The
 * one cast lives in `audit.repository.ts` at the Prisma call instead, which keeps the
 * `any` out of the domain type and out of every call site.
 */
export type AuditMetadata = Record<string, unknown>;

export interface AdminLogEntry {
  id: string;
  adminId: string;
  adminName: string | null;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

export interface CreateLogInput {
  adminId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: AuditMetadata;
}

export interface LogFilters {
  adminId?: string;
  resource?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface LogResult {
  logs: AdminLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


