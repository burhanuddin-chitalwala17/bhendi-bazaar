import { MARKETPLACE_KINDS, marketplaceNeeds } from "../marketplace";
import { issueKind } from "./issue.kind";
import type { NeedSource, TicketKindPlugin } from "./kind";

/**
 * Every kind and every source of needs, once (D4). The engine reads these lists and nothing else;
 * a module plugs in by adding its folder's exports here.
 */
export const KINDS: readonly TicketKindPlugin[] = [issueKind, ...MARKETPLACE_KINDS];
export const NEED_SOURCES: readonly NeedSource[] = [marketplaceNeeds];

const byKind = new Map(KINDS.map((k) => [k.kind, k]));
export const kindOf = (kind: string): TicketKindPlugin | null => byKind.get(kind) ?? null;

export { issueKind };
export { PlanUnavailableError, type NeedSource, type TicketKindPlugin } from "./kind";
