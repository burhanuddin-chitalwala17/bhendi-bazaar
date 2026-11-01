import type { Prisma } from "@prisma/client";

import { NotFoundError } from "@server/shared/domain-error";
import { courierConflictRepository } from "@server/shipping/repositories/courier-conflict.repository";
import type { CourierConflictKind } from "@server/shipping/domain/shipping.types";

/** One AWB's unmatched updates, shown as one row with a count (ux.md "admin conflicts", Many items). */
export interface CourierConflictRow {
  id: string;
  kind: CourierConflictKind;
  awb: string;
  parcelCode: string | null;
  courierWording: string;
  /** Newest update's arrival, ISO. */
  receivedAt: string;
  updates: number;
  /** The newest update's body, pretty-printed, behind "Show details". */
  payload: string;
  dismissedByName: string | null;
  dismissed: boolean;
}

export const CONFLICTS_PAGE = 50;

/** An update we could not apply (D10): recorded for a person, never dropped and never retried. */
export async function recordCourierConflict(input: {
  kind: CourierConflictKind;
  provider: string;
  awb: string;
  shipment: { id: string; code: string } | null;
  courierWording: string;
  payload: Prisma.InputJsonValue;
}): Promise<void> {
  await courierConflictRepository.create({
    kind: input.kind,
    provider: input.provider,
    awb: input.awb,
    shipmentId: input.shipment?.id ?? null,
    parcelCode: input.shipment?.code ?? null,
    courierWording: input.courierWording,
    payload: input.payload,
  });
}

/** The newest `shown` updates, open first, folded into one row per AWB and state. */
export async function listCourierConflicts(shown: number): Promise<{ rows: CourierConflictRow[]; more: boolean }> {
  const found = await courierConflictRepository.list(shown + 1);
  const more = found.length > shown;
  const rows = new Map<string, CourierConflictRow>();
  for (const c of found.slice(0, shown)) {
    const key = `${c.dismissedAt ? "done" : "open"}:${c.awb}`;
    const seen = rows.get(key);
    if (seen) {
      seen.updates += 1;
      continue;
    }
    rows.set(key, {
      id: c.id,
      kind: c.kind as CourierConflictKind,
      awb: c.awb,
      parcelCode: c.parcelCode,
      courierWording: c.courierWording,
      receivedAt: c.createdAt.toISOString(),
      updates: 1,
      payload: JSON.stringify(c.payload, null, 2),
      dismissedByName: c.dismissedByName,
      dismissed: c.dismissedAt !== null,
    });
  }
  return { rows: [...rows.values()], more };
}

export async function countOpenCourierConflicts(): Promise<number> {
  return await courierConflictRepository.countOpen();
}

/** Dismiss a row and every other open update for its AWB, as the list shows them as one. */
export async function dismissCourierConflict(id: string, byName: string): Promise<void> {
  const row = await courierConflictRepository.findAwb(id);
  if (!row) throw new NotFoundError("Conflict not found");
  await courierConflictRepository.dismissOpenForAwb(row.awb, byName);
}
