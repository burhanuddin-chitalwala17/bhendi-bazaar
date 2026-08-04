/**
 * Admin Log Repository
 * Handles database operations for admin activity logging
 */

import { prisma } from "@server/shared/prisma";
import type {
  AdminLogEntry,
  CreateLogInput,
  LogFilters,
} from "@server/shared/audit/audit.types";

export class AdminLogRepository {
  /**
   * Create a new admin log entry
   */
  async createLog(data: CreateLogInput): Promise<AdminLogEntry> {
    const log = await prisma.adminLog.create({
      data: {
        adminId: data.adminId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        metadata: data.metadata || {},
      },
      include: {
        admin: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      id: log.id,
      adminId: log.adminId,
      adminName: log.admin.name,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    };
  }

  /**
   * Get paginated logs with filters
   */
  async getLogs(filters: LogFilters) {
    const {
      adminId,
      resource,
      action,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (adminId) where.adminId = adminId;
    if (resource) where.resource = resource;
    if (action) where.action = action;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          admin: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.adminLog.count({ where }),
    ]);

    const logEntries: AdminLogEntry[] = logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminName: log.admin.name,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    return { logs: logEntries, total };
  }
}

export const adminLogRepository = new AdminLogRepository();


