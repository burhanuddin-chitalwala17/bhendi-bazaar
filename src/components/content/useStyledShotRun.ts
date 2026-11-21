"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ENHANCEMENT_STATE, type EnhancementDto, type RequestStyledInput } from "@server/content/enhancement.types";
import { styledShotApiClient } from "./styledShotApiClient";

/**
 * How often a run is asked after (review, 2026-11-21): every 3 s while a fast model might already be
 * done, then every 6 s — each ask is a few billed queries. A picture usually takes 30–40 s; the stop is
 * past the worst real case — two model timeouts, or a redelivered job waiting out IN_FLIGHT_MS (180 s).
 */
const FAST_POLL_MS = 3_000;
const SLOW_POLL_MS = 6_000;
const FAST_FOR_MS = 15_000;
const SLOW_MS = 60_000;
const GIVE_UP_MS = 5 * 60 * 1000;
export const nextPollMs = (elapsed: number) => (elapsed < FAST_FOR_MS ? FAST_POLL_MS : SLOW_POLL_MS);

export type StyledRunPhase =
  | { phase: "idle" }
  | { phase: "working"; startedAt: number; slow: boolean }
  | { phase: "done" }
  | { phase: "failed"; message: string; input: RequestStyledInput }
  /** Stopped asking about a run that may still finish: offering a retry would pay twice (review). */
  | { phase: "lost"; message: string };

/**
 * One AI picture's run (improve-with-ai R7–R9): ask, ask after it until it is kept or has failed, and
 * hold every version made in this session, newest last (Q25). Form state is the dialog's, not this.
 */
export function useStyledShotRun(orgId: string, messages: { couldNotStart: string; couldNotCheck: string }) {
  const [run, setRun] = useState<StyledRunPhase>({ phase: "idle" });
  const [versions, setVersions] = useState<EnhancementDto[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A double tap is one request: a second Generate while one is being asked for is ignored.
  const asking = useRef(false);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const poll = useCallback(
    (id: string, startedAt: number, input: RequestStyledInput) => {
      const tick = async () => {
        try {
          const { enhancement } = await styledShotApiClient.get(orgId, id);
          if (enhancement.state === ENHANCEMENT_STATE.ACCEPTED) {
            setVersions((held) => [...held, enhancement]);
            return setRun({ phase: "done" });
          }
          if (enhancement.state === ENHANCEMENT_STATE.FAILED) {
            return setRun({ phase: "failed", message: enhancement.error ?? messages.couldNotCheck, input });
          }
          const elapsed = Date.now() - startedAt;
          if (elapsed > GIVE_UP_MS) return setRun({ phase: "lost", message: messages.couldNotCheck });
          setRun({ phase: "working", startedAt, slow: elapsed > SLOW_MS });
          timer.current = setTimeout(tick, nextPollMs(elapsed));
        } catch {
          setRun({ phase: "lost", message: messages.couldNotCheck });
        }
      };
      timer.current = setTimeout(tick, FAST_POLL_MS);
    },
    [messages.couldNotCheck, orgId],
  );

  const request = useCallback(
    async (input: RequestStyledInput) => {
      if (asking.current) return;
      asking.current = true;
      stop();
      const startedAt = Date.now();
      setRun({ phase: "working", startedAt, slow: false });
      try {
        const { enhancement } = await styledShotApiClient.request(orgId, input);
        poll(enhancement.id, startedAt, input);
      } catch (cause) {
        setRun({ phase: "failed", message: cause instanceof Error ? cause.message : messages.couldNotStart, input });
      } finally {
        asking.current = false;
      }
    },
    [messages.couldNotStart, orgId, poll, stop],
  );

  const reset = useCallback(() => {
    stop();
    setRun({ phase: "idle" });
    setVersions([]);
  }, [stop]);

  const backToForm = useCallback(() => setRun({ phase: "idle" }), []);

  return { run, versions, request, reset, backToForm };
}
