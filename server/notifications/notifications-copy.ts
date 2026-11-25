/** The hub's words, as signed off in notifications-core ux.md and whatsapp-status-kit ux.md (ADR-0067). */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const NOTIFICATIONS_COPY = {
  statusDue: {
    subject: "Your Status is ready to post",
    tagline: "Your shop",
    body: (n: number) => `${n} Status due now. Open on your phone to post.`,
    button: "Open",
  },
  /** One item in the Needs you sheet. */
  item: {
    conversationWaiting: "A message waiting over 4 hours",
    postFailed: "A post failed",
    connectionNeedsYou: (platform: string | null) => `${platform ?? "A connection"} needs reconnecting`,
    postHeld: "A post is held: check the price in its caption",
    postDue: "Your Status is ready to post",
  },
  /** A kind grouped once it piles up: "Messages waiting · 6". */
  group: {
    conversationWaiting: "Messages waiting",
    postFailed: "Posts failed",
    connectionNeedsYou: "Connections need you",
    postHeld: "Posts held",
    postDue: "Status due",
    withCount: (label: string, n: number) => `${label} · ${n}`,
  },
  platform: { instagram: "Instagram", whatsapp: "WhatsApp", facebook: "Facebook" } as Record<string, string>,
  morning: {
    subject: (n: number, shop: string) => `${n} ${plural(n, "thing is", "things are")} waiting at ${shop}`,
    tagline: "Your shop",
    line: {
      conversationWaiting: (n: number) => `${n} ${plural(n, "message", "messages")} waiting over 4 hours`,
      postFailed: (n: number) => `${n} ${plural(n, "post", "posts")} failed`,
      connectionNeedsYou: (n: number) => `${n} ${plural(n, "connection needs", "connections need")} reconnecting`,
      postHeld: (n: number) => `${n} ${plural(n, "post is", "posts are")} held: check the price in the caption`,
      postDue: (n: number) => `${n} Status due`,
    },
    button: "Open",
    footer: "You get this at 9 am when something is waiting. Turn it off in",
    footerLink: "Notifications",
  },
} as const;
