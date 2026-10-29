/**
 * The refusal's wording, free of server imports so a client component can recognise it —
 * the sign-in form shows it in place of the generic failure (rate-limiting Q18).
 */
const PREFIX = "Too many attempts.";

export function formatTimeRemaining(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function refusalMessage(msUntilReset: number): string {
  return `${PREFIX} Please try again in ${formatTimeRemaining(msUntilReset)}.`;
}

export function isRefusalMessage(message: string | null | undefined): message is string {
  return typeof message === "string" && message.startsWith(PREFIX);
}
