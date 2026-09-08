/**
 * Maintaining the ledger, and recording what was actually paid.
 *
 * The line that decides where editing stops is **payment, not creation**
 * (org-payouts approach). Before an entry has been paid out there is no external fact
 * to contradict, so editing it is correcting the platform's own arithmetic and full
 * CRUD is right. After money has left the bank, the entry is evidence of a transfer
 * that happened; editing it destroys the only property a payout system provides,
 * which is that the ledger and the bank statement agree.
 *
 * Same rule as an invoice: edit the draft freely, issue a credit note against the sent
 * one. Every change either way is captured.
 */

import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { adminLogRepository } from "@server/shared/audit/audit.repository";
import { recordAdminAction, recordAdminActionIn } from "@server/shared/audit/audit.service";
import { ledgerRepository } from "@server/payouts/ledger.repository";
import { prisma } from "@server/shared/prisma";

/** What may be corrected on an entry. Figures only — never its order or organisation. */
export interface EntryEdit {
  grossItemsPaise?: number;
  orgFundedDiscountPaise?: number;
  platformFundedDiscountPaise?: number;
  commissionPaise?: number;
  payablePaise?: number;
  note?: string;
}

export class SettlementService {
  /** An entry is fixed once the settlement holding it has been paid (D8). */
  private async assertEditable(entryId: string) {
    const entry = await ledgerRepository.entryWithSettlement(entryId);
    if (!entry) throw new NotFoundError("Ledger entry not found");
    if (entry.settlement?.status === "PAID") {
      throw new ConflictError(
        "This entry has been paid out. Post a correcting entry instead — the record has to keep matching the bank."
      );
    }
    return entry;
  }

  /**
   * Correct an unsettled entry in place.
   *
   * Marks it manually edited, so a figure that no longer derives from its order is
   * visibly not derived (D9b) — otherwise a hand-corrected number looks exactly like
   * a computed one, and the next person to recompute silently discards the correction.
   */
  async editEntry(entryId: string, edit: EntryEdit, actorId: string) {
    const before = await this.assertEditable(entryId);

    const updated = await ledgerRepository.updateEntry(entryId, { ...edit, isManuallyEdited: true });

    await recordAdminAction({
      adminId: actorId,
      action: "LEDGER_ENTRY_EDITED",
      resource: "OrgLedgerEntry",
      resourceId: entryId,
      metadata: {
        before: {
          payablePaise: before.payablePaise,
          commissionPaise: before.commissionPaise,
          grossItemsPaise: before.grossItemsPaise,
        },
        after: {
          payablePaise: updated.payablePaise,
          commissionPaise: updated.commissionPaise,
          grossItemsPaise: updated.grossItemsPaise,
        },
      },
    });

    return updated;
  }

  /**
   * Remove an entry from every balance without losing it (D9a).
   *
   * Soft, because a hard delete would drop money out of a balance leaving nothing to
   * explain the change — the one outcome a payout record cannot afford.
   */
  async removeEntry(entryId: string, actorId: string, reason?: string) {
    await this.assertEditable(entryId);
    const removed = await ledgerRepository.updateEntry(entryId, {
      deletedAt: new Date(),
      note: reason,
    });
    await recordAdminAction({
      adminId: actorId,
      action: "LEDGER_ENTRY_REMOVED",
      resource: "OrgLedgerEntry",
      resourceId: entryId,
      metadata: { reason: reason ?? null, payablePaise: removed.payablePaise },
    });
    return removed;
  }

  /** Put a removed entry back. */
  async restoreEntry(entryId: string, actorId: string) {
    const restored = await ledgerRepository.updateEntry(entryId, { deletedAt: null });
    await recordAdminAction({
      adminId: actorId,
      action: "LEDGER_ENTRY_RESTORED",
      resource: "OrgLedgerEntry",
      resourceId: entryId,
      metadata: {},
    });
    return restored;
  }

  /**
   * Claim a set of unsettled entries into a settlement.
   *
   * Free-form over whatever is unsettled — no period and no schedule, because a
   * transfer is decided when it suits and a period column would only describe which
   * entries happened to be picked (D7).
   */
  async createSettlement(input: { orgId: string; entryIds: string[]; note?: string }, actorId: string) {
    if (input.entryIds.length === 0) {
      throw new DomainError("Choose at least one entry to settle");
    }

    return await prisma.$transaction(async (tx) => {
      const entries = await ledgerRepository.claimableEntries(input.orgId, input.entryIds, tx);

      // Claiming is scoped by organisation and by "still unclaimed" in the same query,
      // so a stale screen settles nothing rather than settling twice.
      if (entries.length !== input.entryIds.length) {
        throw new ConflictError(
          "Some of those entries have already been settled or removed. Reload and try again."
        );
      }

      const amountPaise = entries.reduce((sum, entry) => sum + entry.payablePaise, 0);
      const count = await ledgerRepository.countSettlements(input.orgId, tx);

      const settlement = await ledgerRepository.createSettlement(
        {
          code: `SET-${input.orgId.slice(-4).toUpperCase()}-${String(count + 1).padStart(4, "0")}`,
          orgId: input.orgId,
          amountPaise,
          status: "PENDING",
          note: input.note,
          createdByUserId: actorId,
        },
        tx
      );

      await ledgerRepository.assignEntries(
        entries.map((entry) => entry.id),
        settlement.id,
        "SETTLED",
        tx
      );

      return settlement;
    });
  }

  /**
   * Record that a settlement was paid, or cancel it.
   *
   * `PAID` fixes the amount and reference (R24) — the transfer really happened at that
   * figure. Cancelling releases the entries back to unsettled, intact.
   */
  async setSettlementStatus(
    id: string,
    input: { status: "PAID" | "CANCELLED"; reference?: string; paidAt?: Date },
    actorId: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const settlement = await ledgerRepository.findSettlement(id, tx);
      if (!settlement) throw new NotFoundError("Settlement not found");
      if (settlement.status === "PAID") {
        throw new ConflictError(
          "This settlement is already recorded as paid. Post a correcting ledger entry instead."
        );
      }

      if (input.status === "PAID") {
        const updated = await ledgerRepository.updateSettlement(
          id,
          {
            status: "PAID",
            reference: input.reference,
            // A paid settlement records a transfer, so it has a date — the database
            // asserts this too.
            paidAt: input.paidAt ?? new Date(),
            updatedByUserId: actorId,
          },
          tx
        );
        await recordAdminActionIn(tx, {
          adminId: actorId,
          action: "SETTLEMENT_PAID",
          resource: "Settlement",
          resourceId: id,
          metadata: { amountPaise: updated.amountPaise, reference: updated.reference ?? null },
        });
        return updated;
      }

      const cancelled = await ledgerRepository.updateSettlement(
        id,
        { status: "CANCELLED", updatedByUserId: actorId },
        tx
      );
      await ledgerRepository.releaseSettlementEntries(id, tx);
      await recordAdminActionIn(tx, {
        adminId: actorId,
        action: "SETTLEMENT_CANCELLED",
        resource: "Settlement",
        resourceId: id,
        metadata: { amountPaise: cancelled.amountPaise },
      });
      return cancelled;
    });

    // Side effect of the transition, fired after commit — same shape as the order-paid
    // confirmation email: the transfer already happened, so a failed email must never
    // look like a failed payout, and it must not undo one either.
    if (input.status === "PAID") {
      this.sendPayoutEmail(result).catch((error) => {
        console.error(
          `[setSettlementStatus] payout email not sent for settlement ${id}`,
          error
        );
      });
    }

    return result;
  }

  /** Notify the organisation once their settlement is recorded as paid. */
  private async sendPayoutEmail(settlement: {
    orgId: string;
    code: string;
    amountPaise: number;
    reference: string | null;
    paidAt: Date | null;
  }): Promise<void> {
    const { orgRepository } = await import("@server/catalog/org.repository");
    const org = await orgRepository.findEmailContact(settlement.orgId);
    if (!org?.email) return;

    const { emailService } = await import("@server/notifications/email.service");
    await emailService.sendPayoutEmail(
      {
        orgId: settlement.orgId,
        orgName: org.name,
        code: settlement.code,
        amountPaise: settlement.amountPaise,
        reference: settlement.reference,
        paidAt: settlement.paidAt ?? new Date(),
      },
      org.email
    );
  }

  /** An entry's change history, read from the audit trail rather than a second table (D9). */
  async entryHistory(entryId: string) {
    return await adminLogRepository.listForResource("OrgLedgerEntry", entryId);
  }
}

export const settlementService = new SettlementService();
