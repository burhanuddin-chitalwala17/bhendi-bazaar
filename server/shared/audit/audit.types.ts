/**
 * Admin Activity Log Domain Types
 */

export interface AdminLogEntry {
  id: string;
  adminId: string;
  adminName: string | null;
  action: string;
  resource: string;
  resourceId: string;
  metadata: any;
  createdAt: Date;
}

export interface CreateLogInput {
  adminId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: any;
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


