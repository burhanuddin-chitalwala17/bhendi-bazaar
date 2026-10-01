"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { enhancementRunApiClient } from "@/components/product/enhancementRunApiClient";
import {
  ENHANCEMENT_STATE,
  type EnhancementDto,
  type EnhancementUsage,
  type RequestEnhancementInput,
} from "@server/content/enhancement.types";

/** How often the sheet asks after a run, and how long before it stops asking (spec A1: under a minute). */
export const ENHANCEMENT_POLL_MS = 2_000;
export const ENHANCEMENT_POLL_LIMIT_MS = 3 * 60 * 1000;

export type EnhancementRun =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "running"; enhancement: EnhancementDto }
  | { phase: "proposed"; enhancement: EnhancementDto }
  | { phase: "deciding"; enhancement: EnhancementDto }
  | { phase: "failed"; message: string };

/**
 * One run's life, as data (image-enhancement spec R3, R10): ask for it, poll until the worker has
 * proposed or failed, then keep or discard. Which tool is offered and what the compare view shows
 * are the sheet's concern. Polling stops on a decision, a failure, the time limit, or unmount.
 */
export function useEnhancementRun(orgId: string) {
  const [run, setRun] = useState<EnhancementRun>({ phase: "idle" });
  const [usage, setUsage] = useState<EnhancementUsage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const failed = (cause: unknown, fallback: string): EnhancementRun => ({
    phase: "failed",
    message: cause instanceof Error ? cause.message : fallback,
  });

  const poll = useCallback(
    (id: string, startedAt: number) => {
      async function tick() {
        try {
          const { enhancement } = await enhancementRunApiClient.get(orgId, id);
          if (enhancement.state === ENHANCEMENT_STATE.PROPOSED) return setRun({ phase: "proposed", enhancement });
          if (enhancement.state === ENHANCEMENT_STATE.FAILED) {
            return setRun({ phase: "failed", message: enhancement.error ?? "The improvement could not be made" });
          }
          if (Date.now() - startedAt >= ENHANCEMENT_POLL_LIMIT_MS) {
            return setRun({ phase: "failed", message: "This is taking longer than expected. Try again in a little while." });
          }
          setRun({ phase: "running", enhancement });
          timer.current = setTimeout(tick, ENHANCEMENT_POLL_MS);
        } catch (cause) {
          setRun(failed(cause, "Could not check on the improvement"));
        }
      }
      timer.current = setTimeout(tick, ENHANCEMENT_POLL_MS);
    },
    [orgId],
  );

  const request = useCallback(
    async (input: RequestEnhancementInput) => {
      stop();
      setRun({ phase: "requesting" });
      try {
        const body = await enhancementRunApiClient.request(orgId, input);
        setUsage(body.usage);
        setRun({ phase: "running", enhancement: body.enhancement });
        poll(body.enhancement.id, Date.now());
      } catch (cause) {
        setRun(failed(cause, "Could not start the improvement"));
      }
    },
    [orgId, poll, stop],
  );

  const decide = useCallback(
    async (action: "accept" | "discard"): Promise<EnhancementDto | null> => {
      if (run.phase !== "proposed") return null;
      const { enhancement } = run;
      setRun({ phase: "deciding", enhancement });
      try {
        const body = await enhancementRunApiClient.decide(orgId, enhancement.id, action);
        setRun({ phase: "idle" });
        return body.enhancement;
      } catch (cause) {
        setRun(failed(cause, action === "accept" ? "Could not keep the improvement" : "Could not discard the improvement"));
        return null;
      }
    },
    [orgId, run],
  );

  const reset = useCallback(() => {
    stop();
    setRun({ phase: "idle" });
  }, [stop]);

  return {
    run,
    usage,
    request,
    accept: () => decide("accept"),
    discard: () => decide("discard"),
    reset,
  };
}
