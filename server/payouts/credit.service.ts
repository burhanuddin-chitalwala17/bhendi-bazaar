import { CreditLineKind } from "@prisma/client";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import { recordAdminAction, recordAdminActionIn } from "@server/shared/audit/audit.service";
import { creditRepository, type CreditDb, type CreditLineRow } from "@server/payouts/credit.repository";
import { paymentDetailsRepository } from "@server/payouts/payment-details.repository";
import {
  CREDIT_RUN,
  REVERSIBLE_KINDS,
  withMargin,
  type AdminCreditAccountDto,
  type CreditAccountDto,
  type CreditLineDto,
  type CreditRun,
  type PaymentDetailsDto,
  type PaymentProof,
} from "@server/payouts/credit.types";

/**
 * A shop's credit for AI pictures (ai-images/shop-credits). The admin records money that came in;
 * a run is charged, settled and refunded through the three calls at the bottom, which are what the
 * content domain uses — it never writes a line itself.
 */

/** A charge the balance cannot cover (R7): a `DomainError` the sheet shows, carrying the balance. */
export class InsufficientCreditError extends ConflictError {
  constructor(
    readonly balancePaise: number,
    readonly neededPaise: number,
    run: CreditRun = CREDIT_RUN.PICTURE,
  ) {
    super(run.short);
    this.name = "InsufficientCreditError";
  }
}

const PAGE = 30;

function toDto(row: CreditLineRow, forAdmin: boolean): CreditLineDto {
  return {
    id: row.id,
    kind: row.kind,
    amountPaise: row.amountPaise,
    providerCostPaise: forAdmin ? row.providerCostPaise : null,
    marginBps: forAdmin ? row.marginBps : null,
    method: row.method,
    reference: row.reference,
    paidOn: row.paidOn ? row.paidOn.toISOString().slice(0, 10) : null,
    receiptRef: row.receiptRef,
    note: row.note,
    reversed: row.reversedBy !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function accountFor(orgId: string, page: number, forAdmin: boolean): Promise<CreditAccountDto> {
  await creditRepository.ensureGrants([orgId]);
  const [balancePaise, rows, paymentDetails] = await Promise.all([
    creditRepository.balance(orgId),
    creditRepository.lines(orgId, PAGE, (page - 1) * PAGE),
    paymentDetailsRepository.read(),
  ]);
  return {
    balancePaise,
    lines: rows.slice(0, PAGE).map((row) => toDto(row, forAdmin)),
    hasMore: rows.length > PAGE,
    paymentDetails,
  };
}

export const creditService = {
  /** The shop's own sheet (R8): balance, lines without the platform's cost, where to pay. */
  async account(orgId: string, page = 1): Promise<CreditAccountDto> {
    return await accountFor(orgId, page, false);
  },

  /** The admin's tab (R3, R6, R8): the same lines with cost and margin, and the shop's margin. */
  async adminAccount(orgId: string, page = 1, now: Date = new Date()): Promise<AdminCreditAccountDto> {
    const [account, marginOverrideBps, platformMarginBps, spentThisMonthPaise] = await Promise.all([
      accountFor(orgId, page, true),
      creditRepository.orgMarginBps(orgId),
      creditRepository.platformMarginBps(),
      creditRepository.spentSince(orgId, monthStart(now)),
    ]);
    return { ...account, marginOverrideBps, platformMarginBps, spentThisMonthPaise };
  },

  /** Money a shop paid offline, recorded with its proof (R3, Q17). Audited in the same transaction. */
  async recordTopUp(orgId: string, amountPaise: number, proof: PaymentProof, actorId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const line = await creditRepository.insert(
        {
          orgId,
          kind: CreditLineKind.TOP_UP,
          amountPaise,
          method: proof.method,
          reference: proof.reference,
          paidOn: proof.paidOn,
          receiptRef: proof.receiptRef,
          createdByUserId: actorId,
        },
        tx,
      );
      await recordAdminActionIn(tx, {
        adminId: actorId,
        action: "CREDIT_TOP_UP",
        resource: "CreditLine",
        resourceId: line.id,
        metadata: { orgId, amountPaise, method: proof.method, reference: proof.reference },
      });
    });
  },

  /**
   * Undo money recorded by mistake (R4): a new line of the opposite amount naming the original and
   * why. The original stays; a line is reversed at most once (the unique `reversesId`). It may take
   * the balance below zero: correcting money that never arrived cannot wait on what was spent from it.
   */
  async reverse(orgId: string, lineId: string, reason: string, actorId: string): Promise<void> {
    const line = await creditRepository.findLine(orgId, lineId);
    if (!line) throw new NotFoundError("Line not found");
    if (!REVERSIBLE_KINDS.includes(line.kind)) {
      throw new DomainError("Only a starting credit or a top-up can be reversed; a picture's charge settles itself.");
    }
    if (line.reversedBy) throw new ConflictError("This line has already been reversed.");
    try {
      await prisma.$transaction(async (tx) => {
        const reversal = await creditRepository.insert(
          {
            orgId,
            kind: CreditLineKind.REVERSAL,
            amountPaise: -line.amountPaise,
            reversesId: line.id,
            note: reason,
            createdByUserId: actorId,
          },
          tx,
        );
        await recordAdminActionIn(tx, {
          adminId: actorId,
          action: "CREDIT_REVERSED",
          resource: "CreditLine",
          resourceId: reversal.id,
          metadata: { orgId, reverses: line.id, amountPaise: -line.amountPaise, reason },
        });
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictError("This line has already been reversed.");
      }
      throw error;
    }
  },

  async setOrgMargin(orgId: string, marginBps: number | null, actorId: string): Promise<void> {
    await creditRepository.setOrgMarginBps(orgId, marginBps);
    await recordAdminAction({ adminId: actorId, action: "CREDIT_MARGIN_SET", resource: "Org", resourceId: orgId, metadata: { marginBps } });
  },

  async platformMargin(): Promise<number> {
    return await creditRepository.platformMarginBps();
  },

  async setPlatformMargin(marginBps: number, actorId: string): Promise<void> {
    await creditRepository.setPlatformMarginBps(marginBps);
    await recordAdminAction({ adminId: actorId, action: "CREDIT_PLATFORM_MARGIN_SET", resource: "CreditSettings", resourceId: "platform", metadata: { marginBps } });
  },

  async paymentDetails(): Promise<PaymentDetailsDto> {
    return await paymentDetailsRepository.read();
  },

  /** Where shops send money: the most sensitive write here, so every save is on the audit trail. */
  async savePaymentDetails(details: PaymentDetailsDto, actorId: string): Promise<void> {
    await paymentDetailsRepository.save(details, actorId);
    await recordAdminAction({ adminId: actorId, action: "PAYMENT_DETAILS_SAVED", resource: "PlatformPaymentDetails", resourceId: "platform", metadata: { ...details } });
  },

  /** The shop's margin as it applies now: its own, else the platform's (D4). */
  async marginFor(orgId: string): Promise<number> {
    return (await creditRepository.orgMarginBps(orgId)) ?? (await creditRepository.platformMarginBps());
  },

  /** What a picture will take from the shop's credit: cost plus margin, rounded up (D4). */
  async priceFor(orgId: string, costPaise: number): Promise<{ chargePaise: number; marginBps: number }> {
    const marginBps = await this.marginFor(orgId);
    return { chargePaise: withMargin(costPaise, marginBps), marginBps };
  },

  /**
   * Charge a run when it is asked for (R5, R7; D5), inside the caller's transaction so the run and its
   * charge commit together. Locked per shop. It **holds the most expensive model that might answer**
   * (with margin), so concurrent charges can never overdraw, and settling only ever gives some back.
   */
  async charge(
    tx: CreditDb,
    input: { orgId: string; enhancementId: string; costPaise: number; worstCostPaise: number; marginBps: number; run?: CreditRun },
  ): Promise<{ heldPaise: number; balancePaise: number }> {
    const run = input.run ?? CREDIT_RUN.PICTURE;
    await creditRepository.lockOrg(input.orgId, tx);
    await creditRepository.ensureGrants([input.orgId], tx);
    const balance = await creditRepository.balance(input.orgId, tx);
    const worstCost = Math.max(input.costPaise, input.worstCostPaise);
    const heldPaise = withMargin(worstCost, input.marginBps);
    if (balance < heldPaise) throw new InsufficientCreditError(balance, heldPaise, run);
    const written = await creditRepository.insertOnce(
      {
        orgId: input.orgId,
        kind: CreditLineKind.CHARGE,
        amountPaise: -heldPaise,
        providerCostPaise: worstCost,
        marginBps: input.marginBps,
        enhancementId: input.enhancementId,
        runKey: `charge:${input.enhancementId}`,
        note: run.charge,
      },
      tx,
    );
    return { heldPaise, balancePaise: written ? balance - heldPaise : balance };
  },

  /** Runs of one kind (by id prefix) still holding credit after `before`, for the caller's lazy sweep. */
  async openRuns(orgId: string, runPrefix: string, before: Date): Promise<string[]> {
    return await creditRepository.openRuns(orgId, runPrefix, before);
  },

  /**
   * The run made its picture at `actualCostPaise` (D5): what was held beyond cost plus margin comes
   * back in one line. A run has exactly one closing line — this or a refund, whichever is first —
   * so a late settle after a refund, or the reverse, changes nothing.
   */
  async settle(enhancementId: string, actualCostPaise: number, label: CreditRun = CREDIT_RUN.PICTURE): Promise<void> {
    const run = await creditRepository.netForRun(enhancementId);
    if (!run.orgId || !run.charge) return;
    const owed = withMargin(actualCostPaise, run.charge.marginBps ?? 0);
    // What was held, less what is owed; never a further charge: the hold was the worst case.
    const back = Math.max(0, -run.paise - owed);
    await creditRepository.insertOnce({
      orgId: run.orgId,
      kind: CreditLineKind.ADJUSTMENT,
      amountPaise: back,
      providerCostPaise: actualCostPaise,
      marginBps: run.charge.marginBps,
      enhancementId,
      runKey: `close:${enhancementId}`,
      note: label.settle,
    });
  },

  /** A run that made nothing gives back everything it held (Q20). Its closing line, written once. */
  async refund(enhancementId: string, label: CreditRun = CREDIT_RUN.PICTURE): Promise<void> {
    const run = await creditRepository.netForRun(enhancementId);
    if (!run.orgId || !run.charge) return;
    await creditRepository.insertOnce({
      orgId: run.orgId,
      kind: CreditLineKind.REFUND,
      amountPaise: Math.max(0, -run.paise),
      enhancementId,
      runKey: `close:${enhancementId}`,
      note: label.refund,
    });
  },
};
