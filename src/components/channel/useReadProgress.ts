"use client";

import { useEffect, useRef, useState } from "react";
import { listingsApiClient } from "./listingsApiClient";
import { READ_STATE, type ChannelReadDTO } from "@server/channels/channel-connection.types";

/** How often a running read is asked after, how much progress earns a page refresh, and when asking stops. */
export const READ_POLL_MS = 4_000;
export const READ_REFRESH_EVERY_MS = 30_000;
export const READ_POLL_LIMIT_MS = 15 * 60_000;

/**
 * Follows a running read by its progress alone (one small read per poll), so the line's count moves
 * every few seconds while the rows below refresh only when the read ends or every half-minute of
 * progress. Stops on its own after `READ_POLL_LIMIT_MS`, so a tab left open does not keep asking all day.
 */
export function useReadProgress(
  orgId: string,
  channel: string,
  running: boolean,
  refresh: () => void,
): { gaveUp: boolean; latest: ChannelReadDTO | null } {
  const [gaveUp, setGaveUp] = useState(false);
  const [latest, setLatest] = useState<ChannelReadDTO | null>(null);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    let lastRefresh = startedAt;
    let lastDone: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();

    async function tick() {
      if (Date.now() - startedAt >= READ_POLL_LIMIT_MS) return setGaveUp(true);
      try {
        const read = await listingsApiClient.readProgress(orgId, channel, abort.signal);
        setLatest(read);
        if (read.state !== READ_STATE.RUNNING || read.stalled) return refreshRef.current();
        const moved = read.done !== lastDone;
        lastDone = read.done;
        if (moved && Date.now() - lastRefresh >= READ_REFRESH_EVERY_MS) {
          lastRefresh = Date.now();
          refreshRef.current();
        }
      } catch {
        if (abort.signal.aborted) return;
        // A missed poll is not worth a message; the next one tries again.
      }
      timer = setTimeout(tick, READ_POLL_MS);
    }
    timer = setTimeout(tick, READ_POLL_MS);
    return () => {
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [orgId, channel, running]);

  return { gaveUp, latest };
}
