/**
 * Turning a link somebody pasted into a path this store can store.
 *
 * People paste what is in the address bar. That is an absolute URL carrying whatever
 * origin they happened to be on — `http://localhost:3000/store/naaz` works on one
 * machine and nowhere else, and a preview deploy's origin works until the preview is
 * gone. Storing the **path** is what makes a link survive the environment it was
 * written in, which is the same reason `appUrl()` exists rather than a constant
 * (CLAUDE.md: never hardcode our own origin).
 *
 * Shared by the platform's home banners and an org's storefront promotions: both
 * collect a destination from a person, and a second copy of this rule is a second
 * chance for the two to disagree about what counts as our own site.
 */

import { appUrl } from "@server/shared/app-url";

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

/** Did someone paste a full URL rather than type a path? */
export function isAbsoluteHref(value: string): boolean {
  return ABSOLUTE.test(value.trim());
}

/**
 * Whether an absolute URL points at this deployment.
 *
 * `appUrl()` throws when the origin is not configured. A link is not the place to take
 * a deploy down over that, so an unset origin accepts the link and lets the caller's
 * own path rules decide — the stored value is a path either way, so a foreign origin
 * can never survive into a rendered link.
 */
function sameOriginAsApp(url: URL): boolean {
  try {
    return url.origin === new URL(appUrl()).origin;
  } catch {
    return true;
  }
}

/**
 * The internal path this link names, or `null` if it names somewhere else.
 *
 * A relative path is returned as given. An absolute URL on our own origin is reduced
 * to its path and query. Anything else — another site, a `mailto:`, a `javascript:`,
 * something unparseable — is `null`, and the caller decides what to say about it.
 *
 * Refusing rather than silently reducing a foreign URL is deliberate: taking the path
 * off `https://example.com/store/naaz` would turn somebody's mistake into a different
 * destination that happens to be valid here, which is worse than telling them.
 */
export function toInternalPath(
  value: string | null | undefined,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (!isAbsoluteHref(raw)) {
    // Protocol-relative: `//evil.test/x` is a different site wearing a path's clothes.
    if (raw.startsWith("//")) return null;
    return raw.startsWith("/") ? raw : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!sameOriginAsApp(parsed)) return null;

  return `${parsed.pathname}${parsed.search}`;
}
