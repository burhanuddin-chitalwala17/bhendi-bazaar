// The inbox and history are the two halves of one table, split on isRead. A notification
// in both, or in neither, is the failure; and a link must stay on this site.
import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@server/shared/prisma", () => ({
  prisma: { inAppNotification: { findMany: (args: unknown) => findMany(args) } },
}));

const { inAppNotificationRepository } = await import("@server/notifications/in-app.repository");
const { NOTIFICATION_VIEW } = await import("@server/notifications/in-app.types");
const { internalLink } = await import("@/components/notifications/notification-meta");

const where = () => findMany.mock.calls[0][0].where;
const orderBy = () => findMany.mock.calls[0][0].orderBy;

describe("inbox and history", () => {
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
  });

  it("lists only unread notifications in the inbox, newest first", async () => {
    await inAppNotificationRepository.findByUserId({ userId: "u-1", view: NOTIFICATION_VIEW.INBOX });
    expect(where()).toEqual({ userId: "u-1", isRead: false });
    expect(orderBy()[0]).toEqual({ createdAt: "desc" });
  });

  it("defaults to the inbox when no view is given", async () => {
    await inAppNotificationRepository.findByUserId({ userId: "u-1" });
    expect(where()).toEqual({ userId: "u-1", isRead: false });
  });

  it("lists only read notifications in history, most recently read first", async () => {
    await inAppNotificationRepository.findByUserId({ userId: "u-1", view: NOTIFICATION_VIEW.HISTORY });
    expect(where()).toEqual({ userId: "u-1", isRead: true });
    expect(orderBy()[0]).toEqual({ readAt: "desc" });
  });

  it("pages history with a cursor that ties on id", async () => {
    findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const page = await inAppNotificationRepository.findByUserId({
      userId: "u-1",
      view: NOTIFICATION_VIEW.HISTORY,
      limit: 2,
    });
    expect(page.notifications.map((n) => n.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("c");
    expect(orderBy()[1]).toEqual({ id: "desc" });
  });
});

describe("a notification's link", () => {
  it("is followed when it is a path on this site", () => {
    expect(internalLink("/order/abc")).toBe("/order/abc");
  });

  it("is dropped when it would leave the site", () => {
    expect(internalLink("https://example.com/login")).toBeNull();
    expect(internalLink("//example.com/login")).toBeNull();
    expect(internalLink("javascript:alert(1)")).toBeNull();
    expect(internalLink(null)).toBeNull();
  });
});
