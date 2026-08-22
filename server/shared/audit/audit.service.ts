/**
 * Admin Log Service
 * Business logic for activity logging
 */

import {
  adminLogRepository,
  type AuditDb,
} from "@server/shared/audit/audit.repository";
import type {
  CreateLogInput,
  LogFilters,
  LogResult,
} from "@server/shared/audit/audit.types";

/**
 * Record an action that has already committed.
 *
 * Never throws. The trail says a thing happened; it must not decide whether it
 * happened. A dangling `adminId` made every `adminLog.create` fail the foreign key,
 * and because the log ran after the mutation, a created category and a deleted one
 * both came back as 409 — so the admin retried and hit "slug already in use".
 *
 * A dropped entry is reported to the platform logs, which is where the action can
 * still be recovered from. Use `recordAdminActionIn` when the mutation has not
 * committed yet and the two should stand or fall together.
 */
export async function recordAdminAction(entry: CreateLogInput): Promise<void> {
  try {
    await adminLogRepository.createLog(entry);
  } catch (error) {
    console.error("Audit trail write failed; the action itself succeeded", {
      entry,
      error,
    });
  }
}

/**
 * Record an action inside the transaction that performs it — both commit or neither.
 *
 * Throws, deliberately: within a transaction a failed write has already poisoned it,
 * so swallowing the error only moves the failure to COMMIT. Reporting a failure is
 * honest here because the mutation rolls back with it.
 */
export async function recordAdminActionIn(
  db: AuditDb,
  entry: CreateLogInput
): Promise<void> {
  await adminLogRepository.createLog(entry, db);
}

export class AdminLogService {
  /**
   * Get paginated logs with filters
   */
  async getLogs(filters: LogFilters): Promise<LogResult> {
    const { logs, total } = await adminLogRepository.getLogs(filters);

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const totalPages = Math.ceil(total / limit);

    return {
      logs,
      total,
      page,
      limit,
      totalPages,
    };
  }
}

export const adminLogService = new AdminLogService();


