/** The bell and Notifications settings, as signed off in notifications-core ux.md (ADR-0067). */
export const NOTIFICATIONS_UI_COPY = {
  bell: {
    title: "Needs you",
    label: (n: number) => (n > 0 ? `Needs you: ${n}` : "Needs you"),
    close: "Close",
    empty: "Nothing needs you right now.",
    failed: "Could not load what needs you. Try again.",
  },
  settings: {
    title: "Notifications",
    help: "How this shop tells you what needs you.",
    link: "Notifications",
    morningEmail: "Morning email · 9 am",
    statusNote: "Status alerts still come by email, since they can't wait.",
    on: "Morning email on.",
    off: "Morning email off.",
  },
} as const;
