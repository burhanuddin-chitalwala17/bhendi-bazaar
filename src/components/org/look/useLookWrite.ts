"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useMutation } from "@/hooks/core/useMutation";
import { ApiError } from "@/lib/api-error";
import type { StorefrontLookState } from "@server/catalog/storefront-look.types";
import { SLOW_AFTER_MS } from "./look-copy";

/** Where a publish or a switch back stands (ux.md preview & publish), compared by constant. */
export const WRITE_STATE = {
  IDLE: "idle",
  FAILED: "failed",
  /** Another member published since the picker read the look (Q31). */
  STALE: "stale",
  /** What it would act on is gone (the kept look's 30 days ended): the refusal, and no resend. */
  GONE: "gone",
} as const;
export type WriteState = (typeof WRITE_STATE)[keyof typeof WRITE_STATE];

/**
 * One look write — Publish or Switch back — and its states (D11). A 409 is the Refused state:
 * the server's words, and the page re-read so "Publish mine anyway" resends at the new version.
 * Never disables the button: a slow write shows its spinner after a second and stays tappable.
 */
export function useLookWrite(write: () => Promise<StorefrontLookState>, onDone: (look: StorefrontLookState) => void) {
  const router = useRouter();
  const [state, setState] = useState<WriteState>(WRITE_STATE.IDLE);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mutate, isLoading } = useMutation(write, { showToast: false });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const run = async () => {
    if (isLoading) return;
    timer.current = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    try {
      const look = await mutate();
      setState(WRITE_STATE.IDLE);
      setRefusal(null);
      router.refresh();
      onDone(look);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setState(WRITE_STATE.STALE);
        setRefusal(error.message);
        router.refresh();
      } else if (error instanceof ApiError && error.status === 410) {
        setState(WRITE_STATE.GONE);
        setRefusal(error.message);
        router.refresh();
      } else {
        setState(WRITE_STATE.FAILED);
        setRefusal(error instanceof ApiError && error.status === 403 ? error.message : null);
      }
    } finally {
      if (timer.current) clearTimeout(timer.current);
      setSlow(false);
    }
  };

  const reset = () => {
    setState(WRITE_STATE.IDLE);
    setRefusal(null);
  };

  return { run, reset, state, refusal, busy: isLoading, slow };
}
