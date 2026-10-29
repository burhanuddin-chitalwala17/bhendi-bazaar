/**
 * The caller's address, from the header the trusted edge sets (rate-limiting D4, Q12).
 * `x-forwarded-for` is never read unless it is the configured header: a caller can send it,
 * so rotating it would reset every per-address budget (spec A5).
 */
import { clientAddressHeader } from "./config";
import type { HeaderSource } from "./types";

/** Every request without the configured header collapses into this one bucket. */
export const UNKNOWN_ADDRESS = "unknown";
/** Local development with no header configured: one developer, one bucket. */
export const LOCAL_ADDRESS = "local";

let reportedMissing = false;

export function clientAddress(headers: HeaderSource, deployed: boolean): string {
  const header = clientAddressHeader();
  if (!header) return deployed ? UNKNOWN_ADDRESS : LOCAL_ADDRESS;

  const value = headers.get(header);
  // An edge that appends puts what it saw last; earlier entries are the caller's to choose.
  const address = value?.split(",").at(-1)?.trim();
  if (address) return address;

  if (deployed && !reportedMissing) {
    reportedMissing = true;
    console.error(
      `[rate-limit] ${header} is missing from a deployed request; such requests share one ` +
        "address budget. Check RATE_LIMIT_CLIENT_IP_HEADER against the host's edge."
    );
  }
  return deployed ? UNKNOWN_ADDRESS : LOCAL_ADDRESS;
}

/** For tests: report the next missing header again. */
export function resetClientAddressReport() {
  reportedMissing = false;
}
