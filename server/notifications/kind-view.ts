import { ROUTES } from "@server/shared/routes";
import { NOTIFICATIONS_COPY } from "./notifications-copy";
import { NOTIFICATION_KIND, type EventFacts, type NotificationKind } from "./notification.types";

type CopyKey = keyof typeof NOTIFICATIONS_COPY.group & keyof typeof NOTIFICATIONS_COPY.morning.line;

export interface KindView {
  copy: CopyKey;
  title(facts: EventFacts): string;
  /** The screen that fixes one item. */
  href(orgId: string, facts: EventFacts): string;
  /** The screen for the kind as a whole: a group row, a morning-email line. */
  listHref(orgId: string): string;
}

const C = NOTIFICATIONS_COPY.item;
const platformName = (facts: EventFacts) => (facts.platform ? (NOTIFICATIONS_COPY.platform[facts.platform] ?? null) : null);

/**
 * How each kind reads and where it opens (ux.md copy deck). A kind whose screen is not built yet opens
 * the shop's home, never a dead link (decisions Q13); the unit that ships its screen points it there.
 */
export const KIND_VIEW: Record<NotificationKind, KindView> = {
  [NOTIFICATION_KIND.CONVERSATION_WAITING]: {
    copy: "conversationWaiting",
    title: () => C.conversationWaiting,
    href: (orgId) => ROUTES.org.home(orgId),
    listHref: (orgId) => ROUTES.org.home(orgId),
  },
  [NOTIFICATION_KIND.POST_FAILED]: {
    copy: "postFailed",
    title: () => C.postFailed,
    href: (orgId) => ROUTES.org.home(orgId),
    listHref: (orgId) => ROUTES.org.home(orgId),
  },
  [NOTIFICATION_KIND.CONNECTION_NEEDS_YOU]: {
    copy: "connectionNeedsYou",
    title: (facts) => C.connectionNeedsYou(platformName(facts)),
    href: (orgId) => ROUTES.org.channels(orgId),
    listHref: (orgId) => ROUTES.org.channels(orgId),
  },
  [NOTIFICATION_KIND.POST_HELD]: {
    copy: "postHeld",
    title: () => C.postHeld,
    href: (orgId) => ROUTES.org.home(orgId),
    listHref: (orgId) => ROUTES.org.home(orgId),
  },
  [NOTIFICATION_KIND.POST_DUE]: {
    copy: "postDue",
    title: () => C.postDue,
    // The Status page ships with whatsapp-status-kit; until then the shop's home (Q13).
    href: (orgId) => ROUTES.org.home(orgId),
    listHref: (orgId) => ROUTES.org.home(orgId),
  },
};
