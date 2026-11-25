import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";

import { KINDS, NEED_SOURCES, PlanUnavailableError, issueKind, kindOf } from "./kinds";
import { issueDetail, issueSubject } from "./kinds/issue.kind";
import { ticketResolvedSpec } from "./requests.job";
import { ticketRepository, type RaiseRow, type TicketRow } from "./ticket.repository";
import {
  CLOSED_REASON,
  SHOP_STATE,
  TICKET_STATUS,
  TICKET_TYPE,
  type AdminIssueDTO,
  type AdminRequirementDTO,
  type ApplyChoice,
  type IssueCategory,
  type NeedInput,
  type PlanBase,
  type PlanUnavailableDTO,
  type ReportInput,
  type ShopState,
  type ShopTicketDTO,
  type TicketSubject,
  type TicketType,
} from "./request.types";

/** A request's words bounded for the inbox (Q27). */
export const WORDS_MAX = 1000;
const PAGE = 25;

const subjectOf = (row: Pick<TicketRow, "subject">) => row.subject as TicketSubject;

function toRow(need: NeedInput, extra: { category?: string | null; words?: string | null } = {}): RaiseRow | null {
  const plugin = kindOf(need.subject.kind);
  if (!plugin) return null;
  return {
    key: plugin.keyOf(need.subject),
    type: plugin.type,
    kind: plugin.kind,
    subject: need.subject,
    orgId: need.orgId,
    productId: need.productId ?? "",
    detail: need.detail ?? null,
    category: extra.category ?? null,
    words: extra.words ?? null,
  };
}

/** What the shop reads for a ticket's status (Q31). */
function shopState(row: TicketRow): ShopState {
  if (row.status === TICKET_STATUS.DONE) return SHOP_STATE.READY;
  if (row.status === TICKET_STATUS.CLOSED && row.closedReason === CLOSED_REASON.NOT_NOW) return SHOP_STATE.NOT_SUPPORTED;
  return SHOP_STATE.WITH_US;
}

/**
 * Tickets for what a shop cannot fix itself (setup-requests): raised from what the app sees, fixed
 * once for every shop that needs it, the line between the shop's view and the admin's held in the
 * DTOs (D11).
 */
export const requestService = {
  /** Raise many needs at once: two statements however many shops (D3, D5). */
  async raise(needs: readonly NeedInput[], now = new Date(), options: { reopen: boolean } = { reopen: true }): Promise<number> {
    const rows = needs.map((n) => toRow(n)).filter((r): r is RaiseRow => r !== null);
    return await ticketRepository.raise(rows, now, options);
  },

  /**
   * Events a module saw, turned into needs by whichever sources understand them, and raised (D5).
   * The engine never reads an event: each source parses its own and answers the needs it finds.
   */
  async raiseFromEvents(events: unknown, now = new Date(), options: { reopen: boolean } = { reopen: true }): Promise<number> {
    const needs = (await Promise.all(NEED_SOURCES.map((source) => source.fromEvents?.(events) ?? Promise.resolve([])))).flat();
    return await this.raise(needs, now, options);
  },

  /** A shop's own report (Q7, Q24): an issue, grouped with the same error elsewhere when one is attached. */
  async report(input: ReportInput, now = new Date()): Promise<void> {
    // A product id the shop does not own is dropped, never shown under its report (Q22).
    if (input.productId && (await productService.countOutsideOrg([input.productId], input.orgId)) > 0) input = { ...input, productId: null };
    const words = input.words.trim();
    if (!words) throw new DomainError("Say what happened in a line or two.", { field: "words" });
    if (words.length > WORDS_MAX) throw new DomainError("Keep it under 1,000 characters.", { field: "words" });
    // From scratch, a report is its own issue: keyed by the shop and the moment, never merged with another's words.
    const subject = issueSubject(input.error, `${input.orgId}:${now.getTime()}`);
    const row = toRow({ orgId: input.orgId, productId: input.productId, subject, detail: input.error }, { category: input.category, words });
    if (row) await ticketRepository.raise([row], now);
  },

  // ── The shop's side (Q25, Q31) ──────────────────────────────────────────────────────────────

  /** Whether a request is the shop's own and still open: what a chat may be shared with support for (inbox-core D9). */
  async isOpenForShop(orgId: string, requestId: string): Promise<boolean> {
    return await ticketRepository.isOpenForOrg(orgId, requestId);
  },

  async forShop(orgId: string, input: { productIds?: readonly string[]; take?: number } = {}): Promise<ShopTicketDTO[]> {
    const rows = await ticketRepository.forOrg(orgId, { productIds: input.productIds, take: input.take ?? PAGE });
    return rows.flatMap((r) => {
      const plugin = kindOf(r.ticket.kind);
      if (!plugin) return [];
      const subject = subjectOf(r.ticket);
      return [{
        id: r.ticket.id,
        type: plugin.type,
        kind: plugin.kind,
        state: shopState(r.ticket),
        title: plugin.shopTitle(subject),
        category: (r.category as IssueCategory | null) ?? null,
        names: plugin.names(subject),
        productId: r.productId || null,
        raisedAt: r.raisedAt.toISOString(),
      }];
    });
  },

  // ── The admin's side (Q3, Q4, Q22, Q26, Q28) ────────────────────────────────────────────────

  async counts(): Promise<Record<TicketType, number>> {
    const c = await ticketRepository.counts();
    return { [TICKET_TYPE.REQUIREMENT]: c[TICKET_TYPE.REQUIREMENT] ?? 0, [TICKET_TYPE.ISSUE]: c[TICKET_TYPE.ISSUE] ?? 0 };
  },

  async inbox(type: TicketType, input: { resolved?: boolean; search?: string | null; page?: number } = {}): Promise<{ rows: AdminRequirementDTO[]; total: number }> {
    const page = Math.max(0, input.page ?? 0);
    const { rows, total } = await ticketRepository.inbox(type, { resolved: input.resolved ?? false, search: input.search?.trim() || null, skip: page * PAGE, take: PAGE });
    return {
      total,
      rows: rows.flatMap((r) => {
        const plugin = kindOf(r.kind);
        if (!plugin) return [];
        return [{
          id: r.id,
          kind: plugin.kind,
          mode: plugin.mode ?? null,
          status: r.status as AdminRequirementDTO["status"],
          title: plugin.adminTitle(subjectOf(r)),
          shopsWaiting: r._count.needs > 1 ? r._count.needs : null,
          reopened: r.reopenedAt !== null && r.status === TICKET_STATUS.OPEN,
          openedAt: r.openedAt.toISOString(),
        }];
      }),
    };
  },

  async requirement(id: string): Promise<AdminRequirementDTO> {
    const row = await ticketRepository.byId(id);
    const plugin = row ? kindOf(row.kind) : null;
    if (!row || !plugin || plugin.type !== TICKET_TYPE.REQUIREMENT) throw new NotFoundError("Request");
    const waiting = await ticketRepository.needCount(id);
    return { id, kind: plugin.kind, mode: plugin.mode ?? null, status: row.status as AdminRequirementDTO["status"], title: plugin.adminTitle(subjectOf(row)), shopsWaiting: waiting > 1 ? waiting : null, reopened: row.reopenedAt !== null && row.status === TICKET_STATUS.OPEN, openedAt: row.openedAt.toISOString() };
  },

  /** The preview, computed live by its kind (D7); the kind's own reason instead when it cannot be. */
  async plan(id: string): Promise<PlanBase | PlanUnavailableDTO> {
    const row = await ticketRepository.byId(id);
    const plugin = row ? kindOf(row.kind) : null;
    if (!row || !plugin?.plan) throw new NotFoundError("Request");
    try {
      return await plugin.plan(subjectOf(row));
    } catch (error) {
      if (error instanceof PlanUnavailableError) return { unavailable: error.reason };
      throw error;
    }
  },

  /**
   * Apply (D7, D8): the plan recomputed and compared with what the admin saw, then the setup and the
   * ticket written in one transaction, only while the ticket is open. A second Apply finds it done.
   */
  async apply(id: string, choice: ApplyChoice, now = new Date()): Promise<{ applied: true } | { stale: PlanBase }> {
    const row = await ticketRepository.byId(id);
    const plugin = row ? kindOf(row.kind) : null;
    if (!row || !plugin?.plan || !plugin.apply) throw new NotFoundError("Request");
    if (row.status !== TICKET_STATUS.OPEN) throw new ConflictError("Already set up. Nothing to do.");
    const plan = await this.plan(id);
    // A preview that could not be read reaches the kind as null: it applies a choice by hand, or refuses.
    const seen = "unavailable" in plan ? null : plan;
    if (seen && seen.hash !== choice.hash) return { stale: seen };
    await prisma.$transaction(async (tx) => {
      const claimed = await ticketRepository.resolve(id, now, tx);
      if (!claimed) throw new ConflictError("Already set up. Nothing to do.");
      await plugin.apply!(tx, subjectOf(row), seen, choice, now);
      await enqueue(tx, ticketResolvedSpec, { ticketId: id });
    });
    return { applied: true };
  },

  async notNow(id: string, now = new Date()): Promise<void> {
    const row = await ticketRepository.byId(id);
    if (!row || kindOf(row.kind)?.type !== TICKET_TYPE.REQUIREMENT) throw new NotFoundError("Request");
    if (!(await ticketRepository.close(id, CLOSED_REASON.NOT_NOW, now))) throw new ConflictError("This request is no longer open.");
    await enqueue(prisma, ticketResolvedSpec, { ticketId: id });
  },

  async issue(id: string): Promise<AdminIssueDTO> {
    const row = await ticketRepository.byId(id);
    if (!row || row.type !== TICKET_TYPE.ISSUE) throw new NotFoundError("Request");
    const s = subjectOf(row);
    const reports = await ticketRepository.reports(id);
    const names = await productService.namesByIds(reports.map((r) => r.productId).filter(Boolean));
    return {
      id,
      status: row.status as AdminIssueDTO["status"],
      title: issueKind.adminTitle(s),
      error: issueDetail(s),
      reports: reports.map((r) => ({ shop: r.org.name, productName: names.get(r.productId) ?? null, category: (r.category as IssueCategory | null) ?? null, words: r.words, at: r.raisedAt.toISOString() })),
      reopened: row.reopenedAt !== null && row.status === TICKET_STATUS.OPEN,
      openedAt: row.openedAt.toISOString(),
    };
  },

  async markFixed(id: string, now = new Date()): Promise<void> {
    const row = await ticketRepository.byId(id);
    if (!row || row.type !== TICKET_TYPE.ISSUE) throw new NotFoundError("Request");
    await prisma.$transaction(async (tx) => {
      if (!(await ticketRepository.resolve(id, now, tx))) throw new ConflictError("This issue is no longer open.");
      await enqueue(tx, ticketResolvedSpec, { ticketId: id });
    });
  },

  /**
   * The daily pass (D9, Q13): drop needs whose product left sale, close what is now set up, then raise
   * what each source's standing check finds. A standing check never reopens what an admin resolved.
   */
  async daily(now = new Date()): Promise<{ resolved: number; raised: number; dropped: number }> {
    const dropped = await ticketRepository.dropLeftSale(now);
    const resolved = await this.resolveSetUp(now);
    const needs = (await Promise.all(NEED_SOURCES.map((source) => source.daily?.(now) ?? Promise.resolve([])))).flat();
    const raised = await this.raise(needs, now, { reopen: false });
    return { resolved, raised, dropped };
  },

  /** Done is checked, not claimed (D9): one read of open tickets, one read per kind of what is set up, one write. */
  async resolveSetUp(now = new Date()): Promise<number> {
    const kinds = KINDS.filter((k) => k.resolvedCheck);
    const open = await ticketRepository.openOfKinds(kinds.map((k) => k.kind));
    const done: string[] = [];
    for (const plugin of kinds) {
      const mine = open.filter((t) => t.kind === plugin.kind);
      if (mine.length === 0) continue;
      const check = await plugin.resolvedCheck!(mine.map(subjectOf));
      for (const t of mine) if (check(subjectOf(t))) done.push(t.id);
    }
    return await ticketRepository.resolveMany(done, now);
  },

};

