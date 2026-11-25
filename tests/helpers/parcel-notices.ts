/**
 * A parcel's notices as the tests read them: one event and its one email delivery each, since parcel notices
 * moved onto the notifications hub (notifications-core D6). `id` is the delivery's, which its send job names.
 */
export async function parcelNotices(shipmentId: string, kind?: string) {
  const { prisma } = await import("@server/shared/prisma");
  const events = await prisma.notificationEvent.findMany({
    where: { shipmentId, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "asc" },
    select: { kind: true, audience: true, facts: true, deliveries: { select: { id: true, recipientId: true } } },
  });
  return events.map((e) => ({ id: e.deliveries[0]?.id, kind: e.kind, audience: e.audience, recipient: e.deliveries[0]?.recipientId, data: e.facts }));
}
