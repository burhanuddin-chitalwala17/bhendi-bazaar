/**
 * Seed reviews — five, chosen to exercise the structure rather than to look populous.
 *
 * Was twenty-two rows of flavour text across seven products, which proved nothing the
 * unit tests do not already prove and made the moderation queue slow to read. Each row
 * below exists to put one behaviour in front of you in the running app:
 *
 *   1 + 2  the same shopper twice on one product — R8 shows both, R10 averages them as
 *          one voice, so `prod-1` reads 4.0 (user-1's latest) and not 4.5
 *   3      a verified purchase, so the badge has somewhere to appear
 *   4      withdrawn by the platform — absent from the product page and the average,
 *          present in the moderation queue
 *   5      retracted by its author — absent from the product page, the average *and*
 *          the org portal, present only in the queue (ADR-0032)
 *
 * Dev only. `prisma/seed-guard.ts` refuses any target that is not a named local database,
 * and refuses outright when VERCEL / CI / NODE_ENV=production is set.
 */

import type { SeedReview } from "./types";

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

export const seedReviews: SeedReview[] = [
  // 1 — user-1's first word on prod-1. Superseded for the average by #2 below.
  {
    id: "review-1",
    productId: "prod-1",
    userId: "user-1",
    rating: 5,
    title: "Absolutely stunning abaya",
    comment:
      "The satin is exceptional and the emerald is deeper in person than in the photographs. It drapes beautifully and I had compliments all evening.",
    userName: "Fatima Khan",
    isVerified: true,
    withdrawnAt: null,
    deletedAt: null,
    media: [],
    createdAt: daysAgo(50),
  },
  // 2 — the same shopper, months later. Both show; only this one counts (R8, R10).
  {
    id: "review-2",
    productId: "prod-1",
    userId: "user-1",
    rating: 3,
    title: "Still good, but the colour has faded",
    comment:
      "Coming back after six months of wear. It has held its shape, but the emerald has gone noticeably flatter after four washes. Worth knowing before you buy.",
    userName: "Fatima Khan",
    isVerified: true,
    withdrawnAt: null,
    deletedAt: null,
    media: [],
    createdAt: daysAgo(3),
  },
  // 3 — a second voice on the same product, with photographs on it.
  {
    id: "review-3",
    productId: "prod-1",
    userId: "user-2",
    rating: 5,
    title: "Worth every rupee",
    comment:
      "The fabric is soft enough to wear all day and the belt detailing is properly finished, not printed on. Photographs of mine attached.",
    userName: "Ayesha Patel",
    isVerified: true,
    withdrawnAt: null,
    deletedAt: null,
    media: [
      "https://placehold.co/800x800/10b981/ffffff.png?text=Reviewer+Photo+1",
      "https://placehold.co/800x800/059669/ffffff.png?text=Reviewer+Photo+2",
    ],
    createdAt: daysAgo(8),
  },
  // 4 — withdrawn by the platform. Gone from the storefront, visible to admin and org.
  {
    id: "review-4",
    productId: "prod-4",
    userId: "user-3",
    rating: 1,
    title: "Nothing to do with the product",
    comment:
      "Seeded withdrawn so the moderation queue has a restorable row, and so you can see the average move when it is restored.",
    userName: "Zainab Sheikh",
    isVerified: false,
    withdrawnAt: daysAgo(2),
    deletedAt: null,
    media: [],
    createdAt: daysAgo(12),
  },
  // 5 — retracted by its author. Visible only in the moderation queue.
  {
    id: "review-5",
    productId: "prod-4",
    userId: "user-2",
    rating: 4,
    title: "Changed my mind about posting this",
    comment:
      "Seeded deleted so you can confirm a retraction leaves the product page, the average and the org portal, and is still readable by the platform.",
    userName: "Ayesha Patel",
    isVerified: true,
    withdrawnAt: null,
    deletedAt: daysAgo(1),
    media: [],
    createdAt: daysAgo(20),
  },
];
