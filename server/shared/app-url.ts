/**
 * App's public origin, for links that leave the server (emails, tracking).
 * Not `NEXTAUTH_URL` — that is NextAuth's own config, and the two diverge on
 * previews and tunnels. Throws rather than mailing `undefined/...`.
 */
export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set; required for outbound links. See docs/OPERATIONS.md."
    );
  }

  return raw.replace(/\/+$/, "");
}
