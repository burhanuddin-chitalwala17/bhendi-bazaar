/**
 * Admin Log Service
 * Business logic for activity logging
 */

import { adminLogRepository } from "@server/shared/audit/audit.repository";
import type { LogFilters, LogResult } from "@server/shared/audit/audit.types";

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


