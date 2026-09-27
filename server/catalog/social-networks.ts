/**
 * The networks a shop may be followed on (brand-page R8, D7).
 *
 * An org supplies a handle and nothing else: it is checked against the network's own
 * shape and the platform composes the address, so a storefront can carry a link to
 * these hosts and to nowhere else. The banner `href` rule in the storefront service is
 * the precedent for refusing a destination rather than repairing it.
 */

interface SocialNetworkRule {
  label: string;
  /** What the network itself accepts as a handle. Anything with a slash or a dot-com fails. */
  handle: RegExp;
  url: (handle: string) => string;
}

export const SOCIAL_NETWORKS = {
  instagram: {
    label: "Instagram",
    handle: /^[A-Za-z0-9._]{1,30}$/,
    url: (handle) => `https://www.instagram.com/${handle}/`,
  },
  facebook: {
    label: "Facebook",
    handle: /^[A-Za-z0-9.]{5,50}$/,
    url: (handle) => `https://www.facebook.com/${handle}`,
  },
  youtube: {
    label: "YouTube",
    handle: /^[A-Za-z0-9._-]{3,30}$/,
    url: (handle) => `https://www.youtube.com/@${handle}`,
  },
  x: {
    label: "X",
    handle: /^[A-Za-z0-9_]{1,15}$/,
    url: (handle) => `https://x.com/${handle}`,
  },
} as const satisfies Record<string, SocialNetworkRule>;

export type SocialNetwork = keyof typeof SOCIAL_NETWORKS;

/** The allowlist's own order, so an icon row reads the same on every shop. */
export const SOCIAL_NETWORK_KEYS = Object.keys(SOCIAL_NETWORKS) as SocialNetwork[];

export const isSocialNetwork = (value: string): value is SocialNetwork =>
  value in SOCIAL_NETWORKS;

/** One way to follow a shop: the handle as shown, and the address the platform built for it. */
export interface SocialLink {
  network: SocialNetwork;
  label: string;
  handle: string;
  href: string;
}

/**
 * `@handle` and `handle` are one intent, so the sigil is dropped before the check. A whole
 * URL pasted into the box is refused rather than parsed: a handle the org could not type
 * is a destination the platform did not compose.
 */
export function normaliseHandle(network: SocialNetwork, raw: string): string | null {
  const handle = raw.trim().replace(/^@/, "");
  return SOCIAL_NETWORKS[network].handle.test(handle) ? handle : null;
}

/**
 * The links a stored `social` JSON yields, in allowlist order, or null when nothing in it is
 * a valid handle on a known network. Unknown keys and malformed values are dropped, never
 * shown — a buyer sees a link or nothing.
 */
export function socialLinksFrom(social: unknown): SocialLink[] | null {
  if (!social || typeof social !== "object" || Array.isArray(social)) return null;
  const entries = social as Record<string, unknown>;

  const links: SocialLink[] = [];
  for (const network of SOCIAL_NETWORK_KEYS) {
    const raw = entries[network];
    if (typeof raw !== "string") continue;
    const handle = normaliseHandle(network, raw);
    if (!handle) continue;
    const rule = SOCIAL_NETWORKS[network];
    links.push({ network, label: rule.label, handle, href: rule.url(handle) });
  }
  return links.length ? links : null;
}
