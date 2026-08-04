/**
 * ShippingEvent Repository
 * 
 * Handles logging and querying of all shipping-related events.
 * Used for debugging, analytics, and audit trails.
 */

import { prisma } from "@server/shared/prisma";
import type { ShippingEvent, Prisma } from "@prisma/client";

export class ShippingEventRepository {
  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  /**
   * Log a shipping event
   */
  async create(
    data: Prisma.ShippingEventCreateInput
  ): Promise<ShippingEvent> {
    return await prisma.shippingEvent.create({ data });
  }

  /**
   * Log multiple events in bulk
   */
  async createMany(
    data: Prisma.ShippingEventCreateManyInput[]
  ): Promise<number> {
    const result = await prisma.shippingEvent.createMany({ data });
    return result.count;
  }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  /**
   * Get all events for an order
   */
  async getByOrderId(orderId: string): Promise<ShippingEvent[]> {
    return await prisma.shippingEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get events for a specific provider
   */
  async getByProviderId(providerId: string, limit = 100): Promise<ShippingEvent[]> {
    return await prisma.shippingEvent.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get events by type
   */
  async getByEventType(
    eventType: string,
    limit = 100
  ): Promise<ShippingEvent[]> {
    return await prisma.shippingEvent.findMany({
      where: { eventType },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get failed events for debugging
   */
  async getFailedEvents(limit = 50): Promise<ShippingEvent[]> {
    return await prisma.shippingEvent.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get recent events with pagination
   */
  async getRecentEvents(params: {
    skip?: number;
    take?: number;
    providerId?: string;
    eventType?: string;
    status?: string;
  }): Promise<{
    events: ShippingEvent[];
    total: number;
  }> {
    const where: Prisma.ShippingEventWhereInput = {
      ...(params.providerId && { providerId: params.providerId }),
      ...(params.eventType && { eventType: params.eventType }),
      ...(params.status && { status: params.status }),
    };

    const [events, total] = await Promise.all([
      prisma.shippingEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
      }),
      prisma.shippingEvent.count({ where }),
    ]);

    return { events, total };
  }

  // ============================================================================
  // ANALYTICS OPERATIONS
  // ============================================================================

  /**
   * Get event statistics by provider
   */
  async getProviderStats(providerId: string): Promise<{
    total: number;
    success: number;
    failed: number;
    pending: number;
    byEventType: Record<string, number>;
  }> {
    const events = await prisma.shippingEvent.findMany({
      where: { providerId },
      select: { status: true, eventType: true },
    });

    const stats = {
      total: events.length,
      success: events.filter((e) => e.status === "success").length,
      failed: events.filter((e) => e.status === "failed").length,
      pending: events.filter((e) => e.status === "pending").length,
      byEventType: {} as Record<string, number>,
    };

    // Count by event type
    events.forEach((event) => {
      stats.byEventType[event.eventType] =
        (stats.byEventType[event.eventType] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get failure rate for a provider
   */
  async getProviderFailureRate(
    providerId: string,
    since?: Date
  ): Promise<number> {
    const where: Prisma.ShippingEventWhereInput = {
      providerId,
      ...(since && { createdAt: { gte: since } }),
    };

    const [total, failed] = await Promise.all([
      prisma.shippingEvent.count({ where }),
      prisma.shippingEvent.count({
        where: { ...where, status: "failed" },
      }),
    ]);

    return total === 0 ? 0 : (failed / total) * 100;
  }

  /**
   * Get event count by date range
   */
  async getEventCountByDateRange(params: {
    providerId?: string;
    startDate: Date;
    endDate: Date;
    eventType?: string;
  }): Promise<number> {
    return await prisma.shippingEvent.count({
      where: {
        ...(params.providerId && { providerId: params.providerId }),
        ...(params.eventType && { eventType: params.eventType }),
        createdAt: {
          gte: params.startDate,
          lte: params.endDate,
        },
      },
    });
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /**
   * Delete old events (for cleanup)
   * Recommended: Keep events for 90 days
   */
  async deleteOldEvents(olderThanDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.shippingEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Delete events for a specific order
   */
  async deleteByOrderId(orderId: string): Promise<number> {
    const result = await prisma.shippingEvent.deleteMany({
      where: { orderId },
    });
    return result.count;
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Check if an order has any shipping events
   */
  async hasEvents(orderId: string): Promise<boolean> {
    const count = await prisma.shippingEvent.count({
      where: { orderId },
    });
    return count > 0;
  }

  /**
   * Get last event for an order
   */
  async getLastEvent(orderId: string): Promise<ShippingEvent | null> {
    return await prisma.shippingEvent.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
  }
}

// Singleton instance
export const shippingEventRepository = new ShippingEventRepository();

