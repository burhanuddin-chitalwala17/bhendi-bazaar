"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { useServerForm } from "@/hooks/core/useServerForm";
import { ApiError } from "@/lib/api-error";
import { openShopSchema } from "@/lib/validation/schemas/org.schema";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import { NAME_SHEET_COPY } from "./shop-details-copy";

const SLOW_AFTER_MS = 3000;
const nameSchema = z.object({ name: openShopSchema.shape.name });
type NameInput = z.infer<typeof nameSchema>;

/** What the sheet shows after "Change name" fails: a retry, a stale version to reload (409), or a refusal. */
export type NameProblem =
  | { kind: "retry" }
  | { kind: "stale"; message: string }
  | { kind: "refused"; message: string }
  | null;

/**
 * A shop's rename (org-profile D7, Q15): the field validates first (ux Terminal error stays on the
 * field), Save opens the confirming sheet only when the name changed, and "Change name" writes.
 */
export function useShopNameChange({
  current,
  save,
  onSaved,
}: {
  current: string;
  save: (name: string) => Promise<ShopDetailsDto>;
  onSaved: (details: ShopDetailsDto) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [slow, setSlow] = useState(false);
  const [problem, setProblem] = useState<NameProblem>(null);
  const busy = useRef(false);

  const form = useServerForm<NameInput>({
    schema: nameSchema,
    defaultValues: { name: current },
    // Nothing is written here: a valid new name only opens the sheet.
    submit: async ({ name }) => {
      if (name !== current) {
        setProblem(null);
        setPending(name);
      }
    },
  });

  useEffect(() => {
    if (!changing) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [changing]);

  // Never disabled (ADR-0053); a second tap while one change is in flight sends nothing.
  const confirm = async () => {
    if (pending === null || busy.current) return;
    busy.current = true;
    setChanging(true);
    setProblem(null);
    try {
      const details = await save(pending);
      toast.success(NAME_SHEET_COPY.changed);
      setPending(null);
      onSaved(details);
      form.reset({ name: details.name });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setProblem({ kind: "stale", message: error.message });
      else if (error instanceof ApiError && error.status < 500) setProblem({ kind: "refused", message: error.message });
      else setProblem({ kind: "retry" });
    } finally {
      busy.current = false;
      setChanging(false);
    }
  };

  const keep = () => {
    setPending(null);
    setProblem(null);
    form.reset({ name: current });
  };

  return { form, pending, changing, slow, problem, confirm, keep };
}
