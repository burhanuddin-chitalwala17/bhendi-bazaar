import { CreditLineKind } from "@prisma/client";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { creditRepository, type CreditDb, type CreditLineRow } from "@server/payouts/credit.repository";
import { paymentDetailsRepository } from "@server/payouts/payment-details.repository";
import {
  REVERSIBLE_KINDS,
  withMargin,
  type AdminCreditAccountDto,
  type CreditAccountDto,
  type CreditLineDto,
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
  ) {
    super("Not enough credit for this picture");
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
   * why. The original stays; a line is reversed at most once (the unique `reversesId`).
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

  async setOrgMargin(orgId: string, marginBps: number | null): Promise<void> {
    await creditRepository.setOrgMarginBps(orgId, marginBps);
  },

  async platformMargin(): Promise<number> {
    return await creditRepository.platformMarginBps();
  },

  async setPlatformMargin(marginBps: number): Promise<void> {
    await creditRepository.setPlatformMarginBps(marginBps);
  },

  async paymentDetails(): Promise<PaymentDetailsDto> {
    return await paymentDetailsRepository.read();
  },

  async savePaymentDetails(details: PaymentDetailsDto, actorId: string): Promise<void> {
    await paymentDetailsRepository.save(details, actorId);
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
   * Charge a run when it is asked for (R5, D5), inside the caller's transaction so the run and its
   * charge commit together. Locked per shop; refused unless the balance covers the most expensive
   * model that might answer, so settling afterwards never takes it below zero (R7).
   */
  async charge(
    tx: CreditDb,
    input: { orgId: string; enhancementId: string; costPaise: number; worstCostPaise: number },
  ): Promise<{ chargePaise: number; balancePaise: number }> {
    const marginBps = await this.marginFor(input.orgId);
    await creditRepository.lockOrg(input.orgId, tx);
    await creditRepository.ensureGrants([input.orgId], tx);
    const balance = await creditRepository.balance(input.orgId, tx);
    const chargePaise = withMargin(input.costPaise, marginBps);
    const worst = withMargin(Math.max(input.costPaise, input.worstCostPaise), marginBps);
    if (balance < worst) throw new InsufficientCreditError(balance, worst);
    await creditRepository.insertOnce(
      {
        orgId: input.orgId,
        kind: CreditLineKind.CHARGE,
        amountPaise: -chargePaise,
        providerCostPaise: input.costPaise,
        marginBps,
        enhancementId: input.enhancementId,
        runKey: `charge:${input.enhancementId}`,
        note: "AI picture",
      },
      tx,
    );
    return { chargePaise, balancePaise: balance - chargePaise };
  },

  /**
   * The run made its picture at `actualCostPaise` (D5): when a fallback model answered at another
   * price, one adjustment makes the run's lines equal cost plus the same margin. Idempotent.
   */
  async settle(enhancementId: string, actualCostPaise: number): Promise<void> {
    const run = await creditRepository.netForRun(enhancementId);
    if (!run.orgId || !run.charge) return;
    const owed = withMargin(actualCostPaise, run.charge.marginBps ?? 0);
    const difference = run.paise + owed;
    if (difference === 0) return;
    await creditRepository.insertOnce({
      orgId: run.orgId,
      kind: CreditLineKind.ADJUSTMENT,
      amountPaise: -difference,
      providerCostPaise: actualCostPaise,
      marginBps: run.charge.marginBps,
      enhancementId,
      runKey: `settle:${enhancementId}`,
      note: "AI picture, another model answered",
    });
  },

  /** A run that made nothing gives back what it took (Q20). Idempotent. */
  async refund(enhancementId: string): Promise<void> {
    const run = await creditRepository.netForRun(enhancementId);
    if (!run.orgId || run.paise >= 0) return;
    await creditRepository.insertOnce({
      orgId: run.orgId,
      kind: CreditLineKind.REFUND,
      amountPaise: -run.paise,
      enhancementId,
      runKey: `refund:${enhancementId}`,
      note: "Picture not made",
    });
  },
};
