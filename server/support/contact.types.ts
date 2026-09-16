import type { ContactMessageStatus } from "@prisma/client";

export type { ContactMessageStatus };

/** What a sender supplies. Name and email are ignored for a signed-in sender (TRD D3). */
export interface ContactMessageInput {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

/** One row as the admin portal reads it. `userId` present means the sender was signed in. */
export interface AdminContactMessage {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactMessageStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactMessageFilters {
  status?: ContactMessageStatus;
  /** Matches name, email, subject or body. */
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "status";
  sortOrder?: "asc" | "desc";
}

export interface ContactMessageListResult {
  messages: AdminContactMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
