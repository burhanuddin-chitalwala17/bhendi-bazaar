/**
 * The shipping label link the admin pastes at booking (order-fulfilment Q23). The label prints the
 * buyer's full address, so the shop only ever opens it through our route (D7, Q26): https, one of
 * these hosts, a 10 s budget. The hosts are what Shiprocket's label links were seen to use
 * (docs/INTEGRATIONS.md, unverified); a link elsewhere is refused at booking, not at download.
 */
const LABEL_HOSTS = ["kr-shipmultichannel-mum.s3.ap-south-1.amazonaws.com", "kr-shipmultichannel.s3.amazonaws.com"] as const;
const LABEL_HOST_SUFFIXES = [".shiprocket.in", ".shiprocket.co"] as const;
const LABEL_TIMEOUT_MS = 10_000;

export function isLabelLink(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return (LABEL_HOSTS as readonly string[]).includes(host) || LABEL_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

/**
 * Fetch the stored label for streaming. Redirects are refused, so a link cannot bounce to a host
 * off the list; null when the link is not one of ours, or the host does not answer in time.
 */
export async function fetchLabel(link: string): Promise<Response | null> {
  if (!isLabelLink(link)) return null;
  try {
    const response = await fetch(link, { redirect: "error", signal: AbortSignal.timeout(LABEL_TIMEOUT_MS), cache: "no-store" });
    return response.ok && response.body ? response : null;
  } catch {
    return null;
  }
}
