import type { Prisma } from "@prisma/client";

import { audienceService } from "@server/audience/audience.service";
import { CONSENT_CHANNEL, MAY_REASON, type MayReason } from "@server/audience/consent.types";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { isUniqueViolation } from "@server/shared/constraint";
import { NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import {
  CAMPAIGNS_COPY,
  HELD_REASON,
  isHeldReason,
  isSkipReason,
  SEND_OUTCOME,
  SEND_PURPOSE,
  SKIP_REASON,
  TOUCH_CHANNEL,
  WA_SEND_STATE,
  type DeliverAnswer,
  type DeliverByWhatsAppInput,
  type HeldReason,
  type MonthSpendDTO,
  type SendHeldResult,
  type SendPurpose,
  type SkipReason,
  type TouchCounts,
} from "./campaigns.types";
import { marketingTouchRepository } from "./marketing-touch.repository";
import { istMonth, istWindowStarts, withinHowOften } from "./messaging-rules";
import { messagingSettingsService } from "./messaging-settings.service";
import { messagingSpendRepository } from "./messaging-spend.repository";
import { categoryOf, estimatePaise } from "./rates";
import { whatsAppSendRepository, type Admitted, type WhatsAppSendRow } from "./whatsapp-send.repository";

const SKIP_FOR_MAY: Record<MayReason, SkipReason> = {
  [MAY_REASON.NOT_OPTED_IN]: SKIP_REASON.NOT_OPTED_IN,
  [MAY_REASON.STOPPED]: SKIP_REASON.STOPPED,
  [MAY_REASON.NO_CHANNEL]: SKIP_REASON.NO_CHANNEL,
};

type Admission = Admitted & { tellShop: boolean };

const skipped = (reason: SkipReason): Admission => ({ state: WA_SEND_STATE.SKIPPED, reason, estimatePaise: 0, spendMonth: null, tellShop: false });
const held = (reason: HeldReason, tellShop = false): Admission => ({ state: WA_SEND_STATE.HELD, reason, estimatePaise: 0, spendMonth: null, tellShop });

/**
 * D1's checks, in one transaction: consent, then the how-often rule for marketing under the buyer's
 * lock, then the spend reservation. Only a queued marketing send writes a touch.
 */
async function admit(
  tx: Prisma.TransactionClient,
  send: { orgId: string; contactId: string; purpose: SendPurpose; sourceRef: string },
  now: Date,
): Promise<Admission> {
  const may = await audienceService.may(send.orgId, send.contactId, CONSENT_CHANNEL.WHATSAPP, tx);
  if (!may.yes) return skipped(SKIP_FOR_MAY[may.reason]);

  const settings = await messagingSettingsService.get(send.orgId, tx);
  const marketing = send.purpose === SEND_PURPOSE.MARKETING;
  if (marketing) {
    await marketingTouchRepository.lock(tx, send.orgId, send.contactId);
    const counts = await marketingTouchRepository.counts(send.orgId, send.contactId, istWindowStarts(now), tx);
    if (!withinHowOften(counts, settings)) return skipped(SKIP_REASON.HOW_OFTEN);
  }

  if (!settings.limitSet) return held(HELD_REASON.LIMIT_NOT_SET);
  const month = istMonth(now);
  const cost = estimatePaise(categoryOf(send.purpose));
  if (!(await messagingSpendRepository.reserve(tx, send.orgId, month, cost, settings.limitPaise))) {
    return held(HELD_REASON.LIMIT, await messagingSpendRepository.claimLimitNotice(tx, send.orgId, month));
  }

  if (marketing) {
    await marketingTouchRepository.record(tx, { orgId: send.orgId, contactId: send.contactId, channel: TOUCH_CHANNEL.WHATSAPP, sourceRef: send.sourceRef, at: now });
  }
  return { state: WA_SEND_STATE.QUEUED, reason: null, estimatePaise: cost, spendMonth: month, tellShop: false };
}

function answerOf(row: WhatsAppSendRow, tellShop = false): DeliverAnswer {
  if (row.state === WA_SEND_STATE.SKIPPED || row.state === WA_SEND_STATE.HELD) {
    if (isSkipReason(row.reason)) return { outcome: SEND_OUTCOME.SKIPPED, sendId: row.id, reason: row.reason };
    if (isHeldReason(row.reason)) return { outcome: SEND_OUTCOME.HELD, sendId: row.id, reason: row.reason, tellShop };
    throw new Error(`WhatsAppSend ${row.id} is ${row.state} with no known reason`);
  }
  return { outcome: SEND_OUTCOME.SENT_QUEUED, sendId: row.id, estimatePaise: row.estimatePaise };
}

/** Thrown inside a release transaction to roll it back without failing Send held. */
class Rollback extends Error {
  constructor(readonly stop: boolean) {
    super("rollback");
  }
}

const RELEASE_BATCH = 100;

/** The one door for every business-initiated WhatsApp message (social-selling/whatsapp-sending D1, Q12). */
export const whatsAppSendService = {
  /**
   * Checks consent, the how-often rule (marketing only) and the spending limit, writes the send row
   * and answers sent, skipped or held. A repeated `idempotencyKey` answers the first call's outcome.
   */
  async deliverByWhatsApp(input: DeliverByWhatsAppInput, now: Date = new Date()): Promise<DeliverAnswer> {
    const existing = await whatsAppSendRepository.byKey(input.orgId, input.idempotencyKey);
    if (existing) return answerOf(existing);
    try {
      return await prisma.$transaction(async (tx) => {
        if (!(await audienceService.isShopContact(input.orgId, input.contactId, tx))) throw new NotFoundError(CAMPAIGNS_COPY.contactNotFound);
        const { tellShop, ...admitted } = await admit(tx, input, now);
        const row = await whatsAppSendRepository.create(tx, {
          orgId: input.orgId,
          contactId: input.contactId,
          templateName: input.template.name,
          language: input.template.language,
          values: input.values,
          purpose: input.purpose,
          sourceRef: input.sourceRef,
          idempotencyKey: input.idempotencyKey,
          ...admitted,
        });
        return answerOf(row, tellShop);
      });
    } catch (error) {
      // Two calls with one key raced: the loser's reservation rolled back; answer the winner's row.
      if (!isUniqueViolation(error, "idempotencyKey")) throw error;
      const winner = await whatsAppSendRepository.byKey(input.orgId, input.idempotencyKey);
      if (!winner) throw error;
      return answerOf(winner);
    }
  },

  /** Marketing touches per buyer per shop today and this IST week, across channels (Q12). */
  async whatsAppCounts(orgId: string, contactId: string, now: Date = new Date()): Promise<TouchCounts> {
    return marketingTouchRepository.counts(orgId, contactId, istWindowStarts(now));
  },

  /** Releases held sends oldest first, re-running every check; stops at the first that is held again (D4). */
  async sendHeld(orgId: string, actorId: string, now: Date = new Date()): Promise<SendHeldResult> {
    let queued = 0;
    let skippedCount = 0;
    let stop = false;
    while (!stop) {
      const batch = await whatsAppSendRepository.held(orgId, RELEASE_BATCH);
      if (batch.length === 0) break;
      let moved = 0;
      for (const row of batch) {
        try {
          const state = await prisma.$transaction(async (tx) => {
            const { tellShop: _ignored, ...next } = await admit(tx, { ...row, purpose: row.purpose as SendPurpose }, now);
            if (next.state === WA_SEND_STATE.HELD) throw new Rollback(true);
            if (!(await whatsAppSendRepository.release(tx, row.id, next))) throw new Rollback(false);
            return next.state;
          });
          moved += 1;
          if (state === WA_SEND_STATE.QUEUED) queued += 1;
          else skippedCount += 1;
        } catch (error) {
          if (!(error instanceof Rollback)) throw error;
          if (error.stop) {
            stop = true;
            break;
          }
        }
      }
      if (moved === 0) break;
    }
    const stillHeld = await whatsAppSendRepository.countHeld(orgId);
    await recordAdminAction({ adminId: actorId, action: "WHATSAPP_HELD_SENT", resource: "WhatsAppSend", resourceId: orgId, metadata: { queued, skipped: skippedCount, stillHeld } });
    return { queued, skipped: skippedCount, stillHeld };
  },

  /** This IST month's spend against the limit, and how many sends wait (R8; ux.md spend card). */
  async spendThisMonth(orgId: string, now: Date = new Date()): Promise<MonthSpendDTO> {
    const month = istMonth(now);
    const [spend, settings, heldCount] = await Promise.all([
      messagingSpendRepository.forMonth(orgId, month),
      messagingSettingsService.get(orgId),
      whatsAppSendRepository.countHeld(orgId),
    ]);
    return {
      month,
      spentPaise: spend?.spentPaise ?? 0,
      reservedPaise: spend?.reservedPaise ?? 0,
      limitPaise: settings.limitPaise,
      heldCount,
    };
  },
};
