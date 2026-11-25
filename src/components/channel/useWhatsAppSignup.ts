"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CONNECT_RESULT, type ConnectResult, type WhatsAppSignupStart } from "@server/channels/channel-connection.types";
import { channelsApiClient } from "./channelsApiClient";
import { loadMetaSdk, openEmbeddedSignup, readSessionInfo, type SessionInfo } from "./meta-sdk";

export type SignupPhase = "idle" | "opening" | "waiting" | "sending";

/** How long the session-info message may trail the pop-up's code; Meta sends both as it closes. */
const INFO_GRACE_MS = 5_000;

type Ready = { result: ConnectResult } | { start: Extract<WhatsAppSignupStart, { state: string }>; fb: NonNullable<Window["FB"]> };

/**
 * Meta's Embedded Signup from tap to outcome (connect-whatsapp D1): open an attempt, load the SDK,
 * hold the pop-up's code and its session-info message, post both back with the attempt's state.
 * `prepare` runs as the finger or pointer reaches the button, so the tap itself opens the pop-up:
 * Safari blocks a window opened after an awaited request (decisions Q24).
 */
export function useWhatsAppSignup(
  orgId: string,
  options: { nonce?: string; prefill?: { name?: string; email?: string; website?: string }; onResult: (result: ConnectResult) => void },
) {
  const [phase, setPhase] = useState<SignupPhase>("idle");
  const busy = useRef(false);
  const prepared = useRef<{ promise: Promise<Ready>; value?: Ready } | null>(null);
  const info = useRef<SessionInfo | "cancelled" | null>(null);
  const infoArrived = useRef<(() => void) | null>(null);
  const { nonce, prefill, onResult } = options;

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      const read = readSessionInfo(event);
      if (read === null) return;
      info.current = read;
      infoArrived.current?.();
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);

  const prepare = useCallback((): Promise<Ready> => {
    if (prepared.current) return prepared.current.promise;
    const promise = (async (): Promise<Ready> => {
      const start = await channelsApiClient.whatsappStart(orgId);
      if ("result" in start) return start;
      return { start, fb: await loadMetaSdk(start.appId, nonce) };
    })();
    const slot: { promise: Promise<Ready>; value?: Ready } = { promise };
    prepared.current = slot;
    promise.then(
      (value) => (slot.value = value),
      () => prepared.current === slot && (prepared.current = null),
    );
    return promise;
  }, [orgId, nonce]);

  const sessionInfo = () =>
    info.current
      ? Promise.resolve(info.current)
      : new Promise<SessionInfo | "cancelled" | null>((resolve) => {
          const timer = setTimeout(() => resolve(info.current), INFO_GRACE_MS);
          infoArrived.current = () => {
            clearTimeout(timer);
            resolve(info.current);
          };
        });

  const connect = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    info.current = null;
    setPhase("opening");
    try {
      // Already prepared: nothing is awaited before the pop-up opens, so it opens inside the tap.
      const ready = prepared.current?.value ?? (await prepare());
      // An attempt is spent once; the next tap opens a new one.
      prepared.current = null;
      if ("result" in ready) return onResult(ready.result);
      setPhase("waiting");
      const code = await openEmbeddedSignup(ready.fb, { configId: ready.start.configId, prefill });
      const found = code ? await sessionInfo() : null;
      if (!code || !found || found === "cancelled") return onResult(CONNECT_RESULT.CANCELLED);
      setPhase("sending");
      const { result } = await channelsApiClient.whatsappSignup({ state: ready.start.state, code, ...found });
      onResult(result);
    } catch {
      prepared.current = null;
      onResult(CONNECT_RESULT.UNREACHABLE);
    } finally {
      busy.current = false;
      setPhase("idle");
    }
    // `sessionInfo` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepare, prefill, onResult]);

  return { phase, prepare, connect };
}
