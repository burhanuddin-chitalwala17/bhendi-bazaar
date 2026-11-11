/**
 * Where a sign-in page may send the shopper afterwards: a same-origin path, else `/`.
 * Anything absolute — `https://…`, `//host`, `/\host`, `javascript:` — is an open
 * redirect waiting for a crafted link (seamless-sign-in D5).
 */
export function safeCallbackUrl(value: string | string[] | null | undefined): string {
  return safeReturnPath(value, "/");
}

/** The same rule for a screen's `from`: our own path, else the screen's natural parent. */
export function safeReturnPath(value: string | string[] | null | undefined, fallback: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/")) return fallback;
  // Browsers read `//` and `/\` as protocol-relative; a control character can hide one.
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  if (/[\x00-\x1f\x7f]/.test(candidate)) return fallback;
  return candidate;
}

/** `href` carrying `from`, so the screen it opens can send Back and Save there (navigation-flows R1). */
export function withFrom(href: string, from: string): string {
  const hashAt = href.indexOf("#");
  const path = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  return `${path}${path.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}${hash}`;
}
