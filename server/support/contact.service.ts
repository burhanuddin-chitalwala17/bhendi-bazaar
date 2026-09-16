import { prisma } from "@server/shared/prisma";
import { contactRepository } from "@server/support/contact.repository";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import type {
  ContactMessageFilters,
  ContactMessageInput,
  ContactMessageListResult,
  ContactMessageStatus,
} from "@server/support/contact.types";

/**
 * Contact us, written half — receiving a message and working through the ones that
 * arrived. The WhatsApp half is a `wa.me` link and never reaches the server
 * (docs/specs/contact-us/trd.md D1).
 */

/** How many messages one sender may file inside the window before being refused. */
export const CONTACT_FLOOD_LIMIT = 3;
export const CONTACT_FLOOD_WINDOW_MS = 10 * 60 * 1000;

export class ContactService {
  /**
   * File a message.
   *
   * A signed-in sender's name and email come from their `User` row, not from the body:
   * the store has to know who wrote, not who claimed to (TRD D3). The body still
   * carries both because the same form serves signed-out visitors, and a `null` name on
   * the account is the one case where what they typed is the better answer.
   *
   * A session pointing at an account that no longer exists is treated as a guest —
   * the foreign key would refuse the row otherwise.
   */
  async submit(
    input: ContactMessageInput,
    userId: string | null,
    now: Date = new Date()
  ): Promise<void> {
    const account = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        })
      : null;

    const sender = account
      ? {
          userId: account.id,
          name: account.name?.trim() || input.name,
          email: account.email || input.email,
        }
      : { userId: null, name: input.name, email: input.email };

    await this.refuseAFlood(sender, now);

    await contactRepository.create({
      userId: sender.userId,
      name: sender.name,
      email: sender.email,
      subject: input.subject?.trim() || null,
      message: input.message,
    });
  }

  /**
   * Naive by design: it counts rows rather than rate-limiting, because
   * `src/lib/rate-limit/` allows everything until the cache is wired, and a limiter
   * that does nothing is worse than an absent one (TRD D6, specs/rate-limiting).
   *
   * A guest who changes the email gets a fresh allowance. That is the known hole, and
   * it closes when the route's `withRateLimit` becomes real.
   */
  private async refuseAFlood(
    sender: { userId: string | null; email: string },
    now: Date
  ): Promise<void> {
    const key = sender.userId ? { userId: sender.userId } : { email: sender.email };
    const since = new Date(now.getTime() - CONTACT_FLOOD_WINDOW_MS);
    const recent = await contactRepository.countRecent(key, since);

    if (recent >= CONTACT_FLOOD_LIMIT) {
      throw new DomainError(
        "You have already sent us a few messages. Please give us a little time to reply before sending another.",
        { status: 429, field: "message" }
      );
    }
  }

  async getMessages(filters: ContactMessageFilters): Promise<ContactMessageListResult> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { messages, total } = await contactRepository.list({ ...filters, page, limit });

    return { messages, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Mark a message resolved, or put it back on the open pile.
   *
   * Audited after the write, not inside it: the trail records what the admin did and
   * must never be what decides whether it happened (ADR-0021).
   */
  async setStatus(
    id: string,
    status: ContactMessageStatus,
    adminId: string
  ): Promise<void> {
    const changed = await contactRepository.setStatus(id, status);
    if (changed === 0) throw new NotFoundError("That message no longer exists");

    await recordAdminAction({
      adminId,
      action: status === "RESOLVED" ? "CONTACT_MESSAGE_RESOLVED" : "CONTACT_MESSAGE_REOPENED",
      resource: "ContactMessage",
      resourceId: id,
      metadata: { status },
    });
  }
}

export const contactService = new ContactService();
