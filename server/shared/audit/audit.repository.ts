/**
 * Admin Log Repository
 * Handles database operations for admin activity logging
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import type {
  AdminLogEntry,
  CreateLogInput,
  LogFilters,
} from "@server/shared/audit/audit.types";

/** Enough of the client to write the trail — satisfied by `prisma` or a `$transaction` tx. */
export type AuditDb = Pick<typeof prisma, "adminLog">;

export class AdminLogRepository {
  /**
   * Append one entry to the trail.
   *
   * Callers go through `recordAdminAction` / `recordAdminActionIn` in audit.service,
   * which decide whether a failure here may reach the caller.
   */
  async createLog(data: CreateLogInput, db: AuditDb = prisma): Promise<void> {
    // No `include`: the writer never reads the admin's name back, and joining for it
    // put a second query on every admin mutation.
    await db.adminLog.create({
      data: {
        adminId: data.adminId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        // The one place the domain's `Record<string, unknown>` meets Prisma's
        // `InputJsonValue`, which demands an index signature no declared interface has.
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  /** Many entries in one statement: a bulk action records each product it changed. */
  async createLogs(entries: readonly CreateLogInput[], db: AuditDb = prisma): Promise<void> {
    if (entries.length === 0) return;
    await db.adminLog.createMany({
      data: entries.map((data) => ({
        adminId: data.adminId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      })),
    });
  }

  /**
   * One resource's entries of the given actions, newest first, without who wrote them: for a reader
   * the acting admin is never shown to (product-form D13).
   */
  async listActionsForResource(resource: string, resourceId: string, actions: readonly string[]) {
    return await prisma.adminLog.findMany({
      where: { resource, resourceId, action: { in: [...actions] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, metadata: true, createdAt: true },
    });
  }

  /** One resource's trail, newest first — an entry's change history (org-payouts D9). */
  async listForResource(resource: string, resourceId: string) {
    return await prisma.adminLog.findMany({
      relationLoadStrategy: "join",
      where: { resource, resourceId },
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { name: true, email: true } } },
    });
  }

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

    const where: Prisma.AdminLogWhereInput = {};

    if (adminId) where.adminId = adminId;
    if (resource) where.resource = resource;
    if (action) where.action = action;

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        relationLoadStrategy: "join",
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


