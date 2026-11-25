import { inboxWaiting } from "@server/inbox/inbox-waiting.service";
import { notificationsService } from "./notifications.service";
import { NOTIFICATION_KIND, type NotificationKind, type StillOpen } from "./notification.types";

/**
 * Every kind's "does this still need the shop?" in one place (decisions Q10), so the answer never
 * depends on which modules a request happened to load. The bell route and the morning email call
 * `registerStillOpenChecks` before reading. Each emitting unit adds its kind here, answered by its
 * own domain's public surface in one batched call; a kind left out keeps its items (never hide work unasked).
 */
const CHECKS: Partial<Record<NotificationKind, StillOpen>> = {
  [NOTIFICATION_KIND.CONVERSATION_WAITING]: (facts) => inboxWaiting.stillWaiting(facts),
};

let registered = false;

export function registerStillOpenChecks(): void {
  if (registered) return;
  for (const [kind, check] of Object.entries(CHECKS) as [NotificationKind, StillOpen][]) notificationsService.registerStillOpen(kind, check);
  registered = true;
}
