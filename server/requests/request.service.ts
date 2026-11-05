import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";
import { TypesUnavailableError, channelTypesService } from "@server/channels/channel-types.service";
import { channelSetupService } from "@server/listing/channel-setup.service";
import { CHANNEL, type Channel } from "@server/shared/channels";

import { needsFrom, type Complaint } from "./complaint-sort";
import { homeBrandOrgId } from "./home-brand";
import { KINDS, kindOf } from "./kinds";
import { ticketResolvedSpec } from "./requests.job";
import { ticketRepository, type RaiseRow, type TicketRow } from "./ticket.repository";
import {
  CLOSED_REASON,
  PLAN_UNAVAILABLE,
  SHOP_STATE,
  TICKET_KIND,
  TICKET_STATUS,
  TICKET_TYPE,
  type AdminIssueDTO,
  type AdminRequirementDTO,
  type ApplyChoice,
  type IssueCategory,
  type NeedInput,
  type PlanUnavailable,
  type ReportInput,
  type RequirementPlanDTO,
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
   * Complaints channels saw, sorted into needs and raised (D5): one read of the products named, one
   * read per channel of what is set up, two writes. The shop's own fixes raise nothing (Q24).
   */
  async raiseFromComplaints(complaints: readonly Complaint[], now = new Date(), options: { reopen: boolean } = { reopen: true }): Promise<number> {
    if (complaints.length === 0) return 0;
    const products = new Map((await channelSetupService.products([...new Set(complaints.map((c) => c.productId))])).map((p) => [p.id, p]));
    const known = complaints.filter((c) => products.get(c.productId)?.archivedAt === null);
    // A live listing's marketplace type is its product type's publishing one: one read per channel (D5).
    const publishing = new Map<string, Awaited<ReturnType<typeof channelSetupService.publishing>>>();
    for (const channel of new Set(known.filter((c) => !c.theirCategory).map((c) => c.channel))) {
      const types = [...new Set(known.filter((c) => c.channel === channel).map((c) => products.get(c.productId)?.productType).filter((t): t is string => !!t))];
      publishing.set(channel, await channelSetupService.publishing(channel as Channel, types));
    }
    const live = known.map((c) => {
      if (c.theirCategory) return c;
      const p = products.get(c.productId)!;
      return { ...c, theirCategory: channelSetupService.publishingOf(publishing.get(c.channel) ?? [], p.productType, p.kind) };
    });
    const byChannel = new Map<string, string[]>();
    for (const c of live) if (c.theirCategory) byChannel.set(c.channel, [...(byChannel.get(c.channel) ?? []), c.theirCategory]);
    const answered = new Map<string, Set<string>>();
    for (const [channel, categories] of byChannel) {
      for (const [category, set] of await channelSetupService.answeredMany(channel as Channel, [...new Set(categories)])) answered.set(`${channel}:${category}`, set);
    }
    const needs = needsFrom(live, (channel, category) => answered.get(`${channel}:${category}`) ?? new Set());
    return await this.raise(needs, now, options);
  },

  /** Types with products and no marketplace type to publish to, for some shops (Q10): one read each side. */
  async raiseMissingCategories(channel: Channel, orgIds: readonly string[], now = new Date()): Promise<number> {
    const inUse = await channelSetupService.typesInUse(orgIds);
    const publishing = new Set((await channelSetupService.publishing(channel, [...new Set(inUse.map((r) => r.productType))])).filter((r) => r.theirCategory).map((r) => r.productType));
    const needs: NeedInput[] = inUse
      .filter((r) => !publishing.has(r.productType))
      .map((r) => ({ orgId: r.orgId, productId: null, subject: { kind: TICKET_KIND.AMAZON_CATEGORY, channel, productType: r.productType, productKind: null } }));
    // A daily standing check: it never reopens what an admin resolved.
    return await this.raise(needs, now, { reopen: false });
  },

  /** A shop's own report (Q7, Q24): an issue, grouped with the same error elsewhere when one is attached. */
  async report(input: ReportInput, now = new Date()): Promise<void> {
    // A product id the shop does not own is dropped, never shown under its report (Q22).
    if (input.productId && (await productService.countOutsideOrg([input.productId], input.orgId)) > 0) input = { ...input, productId: null };
    const words = input.words.trim();
    if (!words) throw new DomainError("Say what happened in a line or two.", { field: "words" });
    if (words.length > WORDS_MAX) throw new DomainError("Keep it under 1,000 characters.", { field: "words" });
    const e = input.error;
    // From scratch, a report is its own issue: keyed by the shop and the moment, never merged with another's words.
    const subject: TicketSubject = e
      ? { kind: TICKET_KIND.ISSUE, channel: e.channel, theirCategory: e.theirCategory, attribute: e.attribute, code: e.code, message: e.message }
      : { kind: TICKET_KIND.ISSUE, channel: null, theirCategory: null, attribute: null, code: `${input.orgId}:${now.getTime()}`, message: null };
    const row = toRow({ orgId: input.orgId, productId: input.productId, subject, detail: e ? { code: e.code, attribute: e.attribute, message: e.message } : null }, { category: input.category, words });
    if (row) await ticketRepository.raise([row], now);
  },

  // ── The shop's side (Q25, Q31) ──────────────────────────────────────────────────────────────

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
    return { id, kind: plugin.kind, status: row.status as AdminRequirementDTO["status"], title: plugin.adminTitle(subjectOf(row)), shopsWaiting: waiting > 1 ? waiting : null, reopened: row.reopenedAt !== null && row.status === TICKET_STATUS.OPEN, openedAt: row.openedAt.toISOString() };
  },

  /** The preview, read live through the home brand (D7, Q14); a reason instead when it cannot be read. */
  async plan(id: string): Promise<RequirementPlanDTO | { unavailable: PlanUnavailable }> {
    const row = await ticketRepository.byId(id);
    const plugin = row ? kindOf(row.kind) : null;
    if (!row || !plugin?.plan) throw new NotFoundError("Request");
    try {
      return await plugin.plan(subjectOf(row), homeBrandOrgId());
    } catch (error) {
      if (error instanceof TypesUnavailableError) return { unavailable: error.reason };
      if (error instanceof DomainError && error.status === 409) return { unavailable: PLAN_UNAVAILABLE.NOT_CONNECTED };
      throw error;
    }
  },

  /**
   * Apply (D7, D8): the plan recomputed and compared with what the admin saw, then the setup and the
   * ticket written in one transaction, only while the ticket is open. A second Apply finds it done.
   */
  async apply(id: string, choice: ApplyChoice, now = new Date()): Promise<{ applied: true } | { stale: RequirementPlanDTO }> {
    const row = await ticketRepository.byId(id);
    const plugin = row ? kindOf(row.kind) : null;
    if (!row || !plugin?.plan || !plugin.apply) throw new NotFoundError("Request");
    if (row.status !== TICKET_STATUS.OPEN) throw new ConflictError("Already set up. Nothing to do.");
    const plan = await this.plan(id);
    if ("unavailable" in plan) {
      // A decision the admin typed needs no preview: the category kind applies a named type by hand (ux "not connected").
      if (row.kind !== TICKET_KIND.AMAZON_CATEGORY || !choice.theirCategory) throw new DomainError("Couldn't reach Amazon. Try again.", { status: 503 });
    } else if (plan.hash !== choice.hash) {
      return { stale: plan };
    }
    const effective: RequirementPlanDTO = "unavailable" in plan
      ? { kind: TICKET_KIND.AMAZON_CATEGORY, productType: "", productTypeLabel: "", options: [], readAt: now.toISOString(), hash: "" }
      : plan;
    await prisma.$transaction(async (tx) => {
      const claimed = await ticketRepository.resolve(id, now, tx);
      if (!claimed) throw new ConflictError("Already set up. Nothing to do.");
      await plugin.apply!(tx, subjectOf(row), effective, choice, now);
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
    const s = subjectOf(row) as Extract<TicketSubject, { kind: typeof TICKET_KIND.ISSUE }>;
    const reports = await ticketRepository.reports(id);
    const names = await productService.namesByIds(reports.map((r) => r.productId).filter(Boolean));
    return {
      id,
      status: row.status as AdminIssueDTO["status"],
      title: KINDS[TICKET_KIND.ISSUE].adminTitle(s),
      error: { channel: s.channel, theirCategory: s.theirCategory, attribute: s.attribute, code: s.channel ? s.code : null, message: s.message },
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
   * Done is checked, not claimed (D9): every open requirement, one read of tickets and one read per
   * kind of what is set up, one write. A setup made by hand in the channel register closes here.
   */
  /** The daily pass (D9, Q10): close what is set up, then raise a category request for each type in use with none. */
  async daily(now = new Date()): Promise<{ resolved: number; raised: number; dropped: number }> {
    // A product taken off sale no longer waits on anything (Q13).
    const dropped = await ticketRepository.dropLeftSale(now);
    const resolved = await this.resolveSetUp(now);
    const connected = await channelTypesService.connectedOrgs();
    let raised = 0;
    for (const channel of new Set(connected.map((c) => c.channel))) {
      // Only marketplaces that create listings from here have a category to publish to (Q10: Amazon).
      if (channel !== CHANNEL.AMAZON) continue;
      raised += await this.raiseMissingCategories(channel, connected.filter((c) => c.channel === channel).map((c) => c.orgId), now);
    }
    return { resolved, raised, dropped };
  },

  async resolveSetUp(now = new Date()): Promise<number> {
    const kinds = Object.values(KINDS).filter((k) => k.resolvedCheck);
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

