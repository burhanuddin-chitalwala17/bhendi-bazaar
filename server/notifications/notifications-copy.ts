/** The hub's words, as signed off in notifications-core ux.md and whatsapp-status-kit ux.md (ADR-0067). */
export const NOTIFICATIONS_COPY = {
  statusDue: {
    subject: "Your Status is ready to post",
    tagline: "Your shop",
    body: (n: number) => `${n} Status due now. Open on your phone to post.`,
    button: "Open",
  },
} as const;
