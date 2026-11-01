// hooks/forms/useFormPersist.ts

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";

/** What is stored: the values, when, and anything the form needs back with them (a seen version). */
interface Envelope {
  savedAt: number;
  values: Record<string, unknown>;
  meta?: unknown;
}

/** A draft found on mount; a `stale` one waits to be asked about rather than restored (product-form D9). */
export interface FoundDraft {
  savedAt: Date;
  meta?: unknown;
  stale: boolean;
}

function readEnvelope(raw: string): Envelope {
  const parsed = JSON.parse(raw);
  // A draft written before the saved-at time existed is the values alone.
  if (parsed && typeof parsed === "object" && "values" in parsed && "savedAt" in parsed) return parsed as Envelope;
  return { savedAt: Date.now(), values: parsed };
}

type DirtyMarks = boolean | DirtyMarks[] | { [key: string]: DirtyMarks | undefined } | undefined;

const anyDirty = (marks: DirtyMarks): boolean =>
  marks === true || (Array.isArray(marks) ? marks.some(anyDirty) : !!marks && typeof marks === "object" && Object.values(marks).some(anyDirty));

/**
 * The values a person changed, by path ("price", "facts.sleeve"): an object field yields only its
 * changed keys, a list is taken whole. Re-applying these never carries an untouched value back.
 */
export function dirtyValues(dirty: Record<string, unknown>, values: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, marks] of Object.entries(dirty) as [string, DirtyMarks][]) {
    const value = values?.[key];
    if (marks && typeof marks === "object" && !Array.isArray(marks) && value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, dirtyValues(marks as Record<string, unknown>, value as Record<string, unknown>, `${prefix}${key}.`));
    } else if (anyDirty(marks)) {
      out[`${prefix}${key}`] = value;
    }
  }
  return out;
}

export function useFormPersist<T extends FieldValues>(
  key: string,
  form: UseFormReturn<T>,
  options: {
    enabled?: boolean;
    excludeFields?: (keyof T)[];
    debounceMs?: number;
    /** Older than this, a draft is offered ("Use it?"), not restored. */
    maxAgeMs?: number;
    /** Saved beside the values and handed back on restore. */
    meta?: () => unknown;
    /** Save only once the person has changed something, so a reset never reads as a draft. */
    onlyWhenDirty?: boolean;
    /** Store only what the person changed, so a restore over newer values re-applies nothing else. */
    dirtyOnly?: boolean;
  } = {}
) {
  const { enabled = true, excludeFields = [], debounceMs = 1000, maxAgeMs, onlyWhenDirty = false, dirtyOnly = false } = options;

  const hasLoadRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const metaRef = useRef(options.meta);
  // useServerForm returns a new object each render; subscribing on it cancelled every queued save.
  const formRef = useRef(form);
  useEffect(() => {
    metaRef.current = options.meta;
    formRef.current = form;
  });
  // A literal array is new every render; as a dependency it re-subscribed and cancelled each queued save.
  const excludeKey = excludeFields.join(",");
  const [found, setFound] = useState<FoundDraft | null>(null);
  const pendingRef = useRef<Envelope | null>(null);

  const apply = useCallback(
    (envelope: Envelope) => {
      Object.keys(envelope.values).forEach((field) => {
        if (!excludeFields.includes(field.split(".")[0] as keyof T)) {
          // Dirty, so a restored draft counts as changes to the leave guard and the save (D9, D10).
          form.setValue(field as Path<T>, envelope.values[field] as PathValue<T, Path<T>>, { shouldDirty: true });
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form]
  );

  // Load from localStorage on mount
  useEffect(() => {
    if (!enabled || hasLoadRef.current) return;
    hasLoadRef.current = true;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(key);
    } catch {
      return;
    }
    if (!saved) return;
    try {
      const envelope = readEnvelope(saved);
      const stale = maxAgeMs !== undefined && Date.now() - envelope.savedAt > maxAgeMs;
      if (stale) pendingRef.current = envelope;
      else apply(envelope);
      setFound({ savedAt: new Date(envelope.savedAt), meta: envelope.meta, stale });
    } catch (err) {
      console.error("Failed to parse saved form data:", err);
      localStorage.removeItem(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // Save to localStorage on change (debounced)
  useEffect(() => {
    if (!enabled) return;

    // watch() ignores a returned cleanup, so the pending save is tracked here;
    // otherwise a queued save lands after clearSaved and resurrects the draft.
    const subscription = formRef.current.watch((data) => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const dirtyFields = formRef.current.formState.dirtyFields as Record<string, unknown>;
        if (onlyWhenDirty && Object.keys(dirtyFields).length === 0) return;
        const dataToSave: Record<string, unknown> = dirtyOnly
          ? dirtyValues(dirtyFields, data as Record<string, unknown>)
          : { ...data };
        for (const path of Object.keys(dataToSave)) {
          if (excludeKey.split(",").includes(path.split(".")[0])) delete dataToSave[path];
        }
        const envelope: Envelope = { savedAt: Date.now(), values: dataToSave, meta: metaRef.current?.() };
        try {
          localStorage.setItem(key, JSON.stringify(envelope));
        } catch {
          // A full or blocked store loses the draft, never the form.
        }
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(saveTimerRef.current);
    };
  }, [key, enabled, excludeKey, debounceMs, onlyWhenDirty, dirtyOnly]);

  const clearSaved = () => {
    clearTimeout(saveTimerRef.current);
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing stored, nothing to clear.
    }
    hasLoadRef.current = false;
    pendingRef.current = null;
    setFound(null);
  };

  /** "Use it": a stale draft the person chose to bring back. */
  const restore = () => {
    if (pendingRef.current) apply(pendingRef.current);
    pendingRef.current = null;
    setFound((current) => (current ? { ...current, stale: false } : current));
  };

  return { clearSaved, found, restore };
}
