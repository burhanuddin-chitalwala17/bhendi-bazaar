/**
 * Limits Meta publishes, as data with their source and the day they were checked (social-selling
 * TRD A-D4). Meta's own pages disagree and change, so a figure that can be read live (Instagram's
 * daily publishing quota) is read, and these are the plan the pacing starts from.
 */
export interface MetaLimit {
  value: number;
  unit: string;
  source: string;
  checked: string;
}

export const META_LIMITS = {
  /** API-published posts per Instagram account per rolling 24 hours; carousels count once. Read live before each publish. */
  instagramPostsPerDay: {
    value: 100,
    unit: "posts / 24 h",
    source: "developers.facebook.com Instagram Platform › Content Publishing (pages also cite 25 and 50)",
    checked: "2026-11-23",
  },
  /** Containers an Instagram account may create per rolling 24 hours. */
  instagramContainersPerDay: {
    value: 400,
    unit: "containers / 24 h",
    source: "developers.facebook.com Instagram Platform › IG User Media",
    checked: "2026-11-23",
  },
  /** Messages per second per WhatsApp number, inbound and outbound together; 1,000 after an upgrade. */
  whatsappMessagesPerSecond: {
    value: 80,
    unit: "messages / s",
    source: "developers.facebook.com WhatsApp Business Platform › Throughput",
    checked: "2026-11-23",
  },
  /** Items in one catalogue `items_batch` call. */
  catalogueItemsPerBatch: {
    value: 5000,
    unit: "items / call",
    source: "developers.facebook.com Marketing API › Product Catalog › items_batch",
    checked: "2026-11-23",
  },
  /** Days after a comment within which one private reply may be sent. */
  instagramPrivateReplyDays: {
    value: 7,
    unit: "days",
    source: "INTEGRATIONS.md › What an inbox receives and may do (checked 2026-11-21)",
    checked: "2026-11-21",
  },
} as const satisfies Record<string, MetaLimit>;

/**
 * The pace each lane starts at (A-D9): well under Meta's ceiling, leaving room for the shop's own
 * app and the inbox. Slowed further when usage headers pass `PRESSURE_SLOWDOWN`.
 */
export const LANE_PACE_PER_SECOND = {
  whatsappMessages: 20,
  instagramMessages: 10,
} as const;

/** A usage header above this share of a limit slows the lane until its reset (A-D9). */
export const PRESSURE_SLOWDOWN = 0.75;
