import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const digestPayload = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export type DigestPayload = z.infer<typeof digestPayload>;

/** "Send this morning's email" (notifications-core D4) for the IST date it is due; handler in `notifications.jobs.ts`. */
export const digestSpec: JobSpec<DigestPayload> = { type: "notify.digest", schema: digestPayload };

const DAY_MS = 86_400_000;
/** 09:00 IST is 03:30 UTC; India keeps no daylight saving. */
const NINE_IST_UTC_MS = (3 * 60 + 30) * 60_000;

/** The next 09:00 IST after `now`: its IST date and how far away it is. */
export function nextDigestRun(now: Date): { date: string; afterSeconds: number } {
  const midnightUtc = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  let at = midnightUtc + NINE_IST_UTC_MS;
  if (at <= now.getTime()) at += DAY_MS;
  return { date: new Date(at).toISOString().slice(0, 10), afterSeconds: Math.ceil((at - now.getTime()) / 1000) };
}
