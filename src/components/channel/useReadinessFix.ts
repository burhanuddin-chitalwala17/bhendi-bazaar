"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { FixPageDTO, FixRowDTO } from "@server/listing/readiness-fix.types";

import { readinessFixApiClient } from "./readinessFixApiClient";
import { FIX } from "./readiness-fix-copy";

const PAGE = 30;

/**
 * A fix page's state (readiness-fix R2–R5): rows to go, rows done with what each got, what is ticked,
 * which rows are saving or failed. Each pick is saved at once (Q4); a bulk pick writes only empty
 * answers and names the rest (Q5).
 */
export function useReadinessFix(orgId: string, page: FixPageDTO) {
  const [rows, setRows] = useState<FixRowDTO[]>(page.rows);
  const [done, setDone] = useState<Array<FixRowDTO & { value: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [onlySaid, setOnlySaid] = useState(false);
  const label = (key: string) => page.options.find((o) => o.key === key)?.label ?? key;
  const mark = (set: React.Dispatch<React.SetStateAction<Set<string>>>, ids: string[], on: boolean) =>
    set((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  async function answer(ids: string[], value: string) {
    mark(setSaving, ids, true);
    mark(setFailed, ids, false);
    try {
      const result = await readinessFixApiClient.answer(orgId, { fact: page.fact, value, productIds: ids });
      const moved = rows.filter((r) => result.set.includes(r.productId));
      setRows((prev) => prev.filter((r) => !result.set.includes(r.productId) && !result.skipped.includes(r.productId)));
      setDone((prev) => [...moved.map((r) => ({ ...r, value })), ...prev]);
      mark(setSelected, ids, false);
      if (ids.length === 1 && result.set.length === 1) toast.success(FIX.saved(moved[0]?.name ?? "", label(value)));
      else if (result.skipped.length > 0) toast.info(FIX.setSkipped(result.set.length, result.skipped.length, page.factLabel));
      else toast.success(FIX.set(result.set.length));
    } catch {
      mark(setFailed, ids, true);
      toast.error(FIX.failed);
    } finally {
      mark(setSaving, ids, false);
    }
  }

  async function undo(row: FixRowDTO & { value: string }) {
    try {
      const { undone } = await readinessFixApiClient.undo(orgId, { fact: page.fact, value: row.value, productIds: [row.productId] });
      setDone((prev) => prev.filter((d) => d.productId !== row.productId));
      if (undone) setRows((prev) => [row, ...prev]);
      else toast.info(FIX.changedElsewhere);
    } catch {
      toast.error(FIX.failed);
    }
  }

  const visible = (onlySaid ? rows.filter((r) => r.said) : rows).slice(0, shown);
  return {
    rows, done, visible, selected, saving, failed, onlySaid, label,
    hasMore: (onlySaid ? rows.filter((r) => r.said).length : rows.length) > shown,
    showMore: () => setShown((n) => n + PAGE),
    toggleOnlySaid: () => setOnlySaid((v) => !v),
    toggle: (id: string) => mark(setSelected, [id], !selected.has(id)),
    answer, undo,
  };
}
