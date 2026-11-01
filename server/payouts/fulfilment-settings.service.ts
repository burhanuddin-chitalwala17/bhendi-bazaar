import { prisma } from "@server/shared/prisma";
import { ConflictError } from "@server/shared/domain-error";
import { indiaTime } from "@server/shared/india-time";
import { formatCurrency, paiseToRupees, rupeesToPaise } from "@server/shared/money";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { fulfilmentSettingsRepository } from "@server/payouts/fulfilment-settings.repository";
import { ledgerRepository } from "@server/payouts/ledger.repository";
import { shopCancelCounts } from "@server/shipping/shipment-status.service";
import { adminOrgService } from "@server/catalog/org.service";

/** ux.md "admin fee setting": the count table looks back 30 days, 50 shops a page. */
export const CANCEL_COUNT_DAYS = 30;
export const CANCEL_COUNT_PAGE = 50;

/** The owner's fee (Q20), what the page shows if the seeded row is ever missing. */
const DEFAULT_FEE_PAISE = 5_000;

/** ux.md "Stale": another admin saved meanwhile. */
export const feeChangedMessage = (feePaise: number, name: string, at: Date) =>
  `Changed to ${formatCurrency(feePaise)} by ${name} at ${indiaTime(at)}. Check before saving.`;

export interface FulfilmentSettingsView {
  feeRupees: number;
  feePaise: number;
  version: number;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface CancelCountRow {
  orgId: string;
  shopName: string;
  count: number;
  feesPaise: number;
}

/**
 * The cancellation fee setting and each shop's cancellation count (order-fulfilment D14, R12a,
 * Q20, Q29). The fee is whole rupees on the form and paise in the row (ADR-0004).
 */
class FulfilmentSettingsService {
  async view(): Promise<FulfilmentSettingsView> {
    const row = await fulfilmentSettingsRepository.read();
    const feePaise = row?.cancellationFeePaise ?? DEFAULT_FEE_PAISE;
    return {
      feeRupees: paiseToRupees(feePaise),
      feePaise,
      version: row?.version ?? 0,
      updatedByName: row?.updatedByName ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  /** Save the fee, compare-and-set on the version the admin saw, audited in the same transaction. */
  async saveFee(input: { feeRupees: number; seenVersion: number }, actor: { id: string; name: string | null }): Promise<FulfilmentSettingsView> {
    const feePaise = rupeesToPaise(input.feeRupees);
    await prisma.$transaction(async (tx) => {
      const before = await fulfilmentSettingsRepository.read(tx);
      const saved = await fulfilmentSettingsRepository.saveFee({ feePaise, seenVersion: input.seenVersion, byName: actor.name }, tx);
      if (!saved) {
        const now = await fulfilmentSettingsRepository.read(tx);
        throw new ConflictError(
          feeChangedMessage(now?.cancellationFeePaise ?? feePaise, now?.updatedByName ?? "another admin", now?.updatedAt ?? new Date()),
        );
      }
      await recordAdminActionIn(tx, {
        adminId: actor.id,
        action: "CANCELLATION_FEE_CHANGED",
        resource: "FulfilmentSettings",
        resourceId: "default",
        metadata: { beforePaise: before?.cancellationFeePaise ?? null, afterPaise: feePaise },
      });
    });
    return await this.view();
  }

  /** Shops by their own cancellations in the last 30 days, most first, with the fees they paid. */
  async cancelCounts(page: number, now: Date = new Date()): Promise<{ rows: CancelCountRow[]; total: number }> {
    const since = new Date(now.getTime() - CANCEL_COUNT_DAYS * 86_400_000);
    const { rows, total } = await shopCancelCounts(since, { skip: (page - 1) * CANCEL_COUNT_PAGE, take: CANCEL_COUNT_PAGE });
    const ids = rows.map((r) => r.orgId);
    const [orgs, fees] = await Promise.all([adminOrgService.summariesFor(ids), ledgerRepository.cancellationFeesByOrg(ids, since)]);
    const names = new Map(orgs.map((o) => [o.id, o.name]));
    return {
      total,
      rows: rows.map((r) => ({ orgId: r.orgId, shopName: names.get(r.orgId) ?? r.orgId, count: r.count, feesPaise: fees.get(r.orgId) ?? 0 })),
    };
  }
}

export const fulfilmentSettingsService = new FulfilmentSettingsService();
