/**
 * Where a sign-in page may send the shopper afterwards: a same-origin path, else `/`.
 * Anything absolute — `https://…`, `//host`, `/\host`, `javascript:` — is an open
 * redirect waiting for a crafted link (seamless-sign-in D5).
 */
export function safeCallbackUrl(value: string | string[] | null | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/")) return "/";
  // Browsers read `//` and `/\` as protocol-relative; a control character can hide one.
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return "/";
  if (/[\x00-\x1f\x7f]/.test(candidate)) return "/";
  return candidate;
}
