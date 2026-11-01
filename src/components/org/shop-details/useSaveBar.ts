"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SHOP_DETAILS_COPY } from "./shop-details-copy";

const SLOW_AFTER_MS = 3000;

/** One section as the bar sees it. `save` resolves false when the section kept its changes (a banner says why). */
export interface SaveBarEntry {
  dirty: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
  /** The toast when this section is the only one saved; absent for one that confirms first (the name sheet). */
  message?: string;
  /** Saved after the rest: the name opens its confirming sheet, which should not sit under later banners. */
  last?: boolean;
}

interface SaveBarApi {
  set: (key: string, entry: SaveBarEntry) => void;
  remove: (key: string) => void;
  saveAll: (event?: React.BaseSyntheticEvent) => Promise<void>;
}

const SaveBarContext = createContext<SaveBarApi | null>(null);
export const SaveBarProvider = SaveBarContext.Provider;

/**
 * Shop details' one Save (org-profile Q30): every changed section saves in turn, each still its own
 * write with the newest version (Q17, Q21), so one section's failure keeps the rest's changes on screen.
 */
export function useSaveBar() {
  const entries = useRef(new Map<string, SaveBarEntry>());
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [slow, setSlow] = useState(false);
  const busy = useRef(false);

  const markDirty = useCallback((key: string, isDirty: boolean) => {
    setDirty((prev) => {
      if (prev.has(key) === isDirty) return prev;
      const next = new Set(prev);
      if (isDirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const set = useCallback((key: string, entry: SaveBarEntry) => {
    entries.current.set(key, entry);
    markDirty(key, entry.dirty);
  }, [markDirty]);
  const remove = useCallback((key: string) => {
    entries.current.delete(key);
    markDirty(key, false);
  }, [markDirty]);

  useEffect(() => {
    if (!saving) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [saving]);

  // Never disabled (ADR-0053); a second tap while saves are in flight sends nothing more.
  const saveAll = useCallback(async (event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      const changed = [...entries.current.entries()]
        .filter(([, entry]) => entry.dirty)
        .sort(([, a], [, b]) => Number(Boolean(a.last)) - Number(Boolean(b.last)));
      const said: string[] = [];
      let failed: string | null = null;
      for (const [key, entry] of changed) {
        if (await entry.save()) {
          if (entry.message) said.push(entry.message);
        } else failed ??= key;
      }
      if (failed) {
        toast.error(SHOP_DETAILS_COPY.notAllSaved);
        showSection(failed);
      } else if (said.length) toast.success(said.length === 1 ? said[0] : SHOP_DETAILS_COPY.savedAll);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, []);

  const discardAll = useCallback(() => {
    for (const entry of entries.current.values()) if (entry.dirty) entry.discard();
  }, []);

  const api = useMemo<SaveBarApi>(() => ({ set, remove, saveAll }), [set, remove, saveAll]);
  return { api, changed: dirty.size > 0, saving, slow, saveAll, discardAll };
}

/** Opens a collapsed optional row holding the failed section and brings it into view; its own banner says why. */
function showSection(key: string) {
  const form = document.getElementById(key);
  const row = form?.closest("details");
  if (row) row.open = true;
  form?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

/** A section joins the bar: reports whether it has changes, and how to save or drop them. */
export function useSaveBarEntry(key: string, entry: SaveBarEntry) {
  const bar = useContext(SaveBarContext);
  const latest = useRef(entry);
  useEffect(() => {
    latest.current = entry;
  });
  const { dirty, message, last } = entry;
  useEffect(() => {
    bar?.set(key, {
      dirty,
      message,
      last,
      save: () => latest.current.save(),
      discard: () => latest.current.discard(),
    });
  }, [bar, key, dirty, message, last]);
  useEffect(() => () => bar?.remove(key), [bar, key]);
}

/** Enter in any section, or a banner's "Try again", saves everything changed. */
export function useSaveAll() {
  const bar = useContext(SaveBarContext);
  return useCallback((event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();
    void bar?.saveAll();
  }, [bar]);
}
