import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import type {
  AdminContactMessage,
  ContactMessageFilters,
  ContactMessageStatus,
} from "@server/support/contact.types";

/**
 * The only place `prisma.contactMessage` is touched (ADR-0003, Invariant 5).
 *
 * Nothing here decides who the sender is or whether they may send — the service owns
 * both, so a route cannot reach a write that skipped them.
 */

/** Whitelisted on the way in: a sender's payload never reaches a `data` argument. */
interface CreateContactMessageRow {
  userId: string | null;
  name: string;
  email: string;
  subject: string | null;
  message: string;
}

export class ContactRepository {
  async create(row: CreateContactMessageRow): Promise<string> {
    const created = await prisma.contactMessage.create({
      data: {
        userId: row.userId,
        name: row.name,
        email: row.email,
        subject: row.subject,
        message: row.message,
      },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * How many messages this sender has filed since `since` — the flood guard's only
   * question (contact-us TRD D6).
   *
   * Keyed on the account when there is one, so changing the email in the form does not
   * reset the count for someone signed in.
   */
  async countRecent(
    sender: { userId: string } | { email: string },
    since: Date
  ): Promise<number> {
    return await prisma.contactMessage.count({
      where: { ...sender, createdAt: { gte: since } },
    });
  }

  async list(
    filters: ContactMessageFilters
  ): Promise<{ messages: AdminContactMessage[]; total: number }> {
    const { status, search, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } =
      filters;

    const where: Prisma.ContactMessageWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { subject: { contains: search, mode: "insensitive" as const } },
              { message: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactMessage.count({ where }),
    ]);

    return { messages, total };
  }

  /** `updateMany` so a vanished row is a count of 0 rather than a thrown Prisma error. */
  async setStatus(id: string, status: ContactMessageStatus): Promise<number> {
    const { count } = await prisma.contactMessage.updateMany({
      where: { id },
      data: { status },
    });
    return count;
  }

  async findById(id: string): Promise<AdminContactMessage | null> {
    return await prisma.contactMessage.findUnique({ where: { id } });
  }
}

export const contactRepository = new ContactRepository();
