"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CONNECT_RESULT, type ConnectResult } from "@server/channels/channel-connection.types";
import { channelsApiClient } from "./channelsApiClient";
import { loadMetaSdk, openEmbeddedSignup, readSessionInfo, type SessionInfo } from "./meta-sdk";

export type SignupPhase = "idle" | "opening" | "waiting" | "sending";

/** How long the session-info message may trail the pop-up's code; Meta sends both as it closes. */
const INFO_GRACE_MS = 5_000;

/**
 * Meta's Embedded Signup from tap to outcome (connect-whatsapp D1): open an attempt, load the SDK,
 * hold the pop-up's code and its session-info message, post both back with the attempt's state.
 */
export function useWhatsAppSignup(
  orgId: string,
  options: { nonce?: string; prefill?: { name?: string; email?: string; website?: string }; onResult: (result: ConnectResult) => void },
) {
  const [phase, setPhase] = useState<SignupPhase>("idle");
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
    if (phase !== "idle") return;
    info.current = null;
    setPhase("opening");
    try {
      const start = await channelsApiClient.whatsappStart(orgId);
      if ("result" in start) return onResult(start.result);
      const fb = await loadMetaSdk(start.appId, nonce);
      setPhase("waiting");
      const code = await openEmbeddedSignup(fb, { configId: start.configId, prefill });
      const found = code ? await sessionInfo() : null;
      if (!code || !found || found === "cancelled") return onResult(CONNECT_RESULT.CANCELLED);
      setPhase("sending");
      const { result } = await channelsApiClient.whatsappSignup({ state: start.state, code, ...found });
      onResult(result);
    } catch {
      onResult(CONNECT_RESULT.UNREACHABLE);
    } finally {
      setPhase("idle");
    }
    // `sessionInfo` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, orgId, nonce, prefill, onResult]);

  return { phase, connect };
}
