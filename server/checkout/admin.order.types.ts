/**
 * Admin Order Management Domain Types
 */

import { Order } from "@prisma/client";

export interface OrderListFilters {
  search?: string; // Search by code, customer name, email
  status?: string; // Filter by order status
  paymentStatus?: string; // Filter by payment status
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "total";
  sortOrder?: "asc" | "desc";
}

export interface OrderListResult {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateOrderStatusInput {
  status?: string;
  notes?: string;
  estimatedDelivery?: string;
}

export interface OrderStats {
  totalOrders: number;
  processingOrders: number;
  packedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  totalRevenue: number;
  revenueThisMonth: number;
  averageOrderValue: number;
}


