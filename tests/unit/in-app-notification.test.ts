import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inAppNotificationService } from "@server/notifications/in-app.service";
import {
  getNotificationsQuerySchema,
  markNotificationReadSchema,
  createInAppNotificationSchema,
} from "@/lib/validation/schemas/notifications";

describe("inAppNotificationService parameter validation", () => {
  it("rejects notification creation when userId, title, or message is missing", async () => {
    await expect(
      inAppNotificationService.notifyUser({
        userId: "",
        title: "Test Title",
        message: "Test Message",
      })
    ).rejects.toThrow("userId, title, and message are required");

    await expect(
      inAppNotificationService.notifyUser({
        userId: "u-1",
        title: "",
        message: "Test Message",
      })
    ).rejects.toThrow("userId, title, and message are required");
  });

  it("rejects fetching notifications without a userId", async () => {
    await expect(
      inAppNotificationService.getUserNotifications({ userId: "" })
    ).rejects.toThrow("userId is required to fetch notifications");
  });

  it("rejects marking notifications as read without a userId", async () => {
    await expect(
      inAppNotificationService.markAsRead({ userId: "" })
    ).rejects.toThrow("userId is required to mark notifications as read");
  });
});

describe("the in-app notifications schema", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  const model = (name: string) => {
    const start = schema.indexOf(`model ${name} {`);
    expect(start).toBeGreaterThan(-1);
    return schema.slice(start, schema.indexOf("\n}", start));
  };

  const notificationModel = model("InAppNotification");
  const userModel = model("User");

  it("defines the InAppNotification model with required fields", () => {
    expect(notificationModel).toMatch(/userId\s+String/);
    expect(notificationModel).toMatch(/title\s+String/);
    expect(notificationModel).toMatch(/message\s+String/);
    expect(notificationModel).toMatch(/type\s+NotificationType/);
    expect(notificationModel).toMatch(/isRead\s+Boolean\s+@default\(false\)/);
  });

  it("links InAppNotification to User with Cascade on delete", () => {
    expect(notificationModel).toMatch(/user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/);
    expect(userModel).toMatch(/inAppNotifications\s+InAppNotification\[\]/);
  });

  it("carries compound indexes for user queries and unread counting", () => {
    expect(notificationModel).toMatch(/@@index\(\[userId, isRead, createdAt\]\)/);
    expect(notificationModel).toMatch(/@@index\(\[userId, createdAt\]\)/);
  });

  it("defines NotificationType enum with expected categories", () => {
    const enumStart = schema.indexOf("enum NotificationType {");
    expect(enumStart).toBeGreaterThan(-1);
    const enumBody = schema.slice(enumStart, schema.indexOf("\n}", enumStart));
    expect(enumBody).toContain("ORDER_UPDATE");
    expect(enumBody).toContain("BID_OUTBID");
    expect(enumBody).toContain("PROMOTION");
    expect(enumBody).toContain("SYSTEM");
  });
});

describe("notification Zod validation schemas", () => {
  it("parses getNotifications query parameters correctly", () => {
    const parsed = getNotificationsQuerySchema.parse({
      limit: "15",
      onlyUnread: "true",
    });
    expect(parsed.limit).toBe(15);
    expect(parsed.onlyUnread).toBe(true);
  });

  it("parses markNotificationRead body correctly", () => {
    const single = markNotificationReadSchema.parse({
      notificationId: "notif-123",
    });
    expect(single.notificationId).toBe("notif-123");

    const all = markNotificationReadSchema.parse({
      markAll: true,
    });
    expect(all.markAll).toBe(true);
  });

  it("validates createInAppNotification schema", () => {
    const valid = createInAppNotificationSchema.parse({
      userId: "user-1",
      title: "Order Shipped",
      message: "Your order #1234 has shipped!",
      type: "ORDER_UPDATE",
    });
    expect(valid.userId).toBe("user-1");
    expect(valid.type).toBe("ORDER_UPDATE");

    expect(() =>
      createInAppNotificationSchema.parse({
        userId: "",
        title: "Test",
        message: "Test",
      })
    ).toThrow();
  });
});

describe("user scoping invariant in repository and routes", () => {
  const repo = readFileSync("server/notifications/in-app.repository.ts", "utf8");
  const getRoute = readFileSync("src/app/api/notifications/route.ts", "utf8");
  const readRoute = readFileSync("src/app/api/notifications/read/route.ts", "utf8");

  it("ensures every repository read and update filters by userId", () => {
    expect(repo).toMatch(/userId: query\.userId/);
    expect(repo).toMatch(/userId,?\s/);
    expect(repo).toMatch(/userId: input\.userId/);
  });

  it("enforces authentication on GET and PATCH route handlers", () => {
    expect(getRoute).toMatch(/getServerSession\(authOptions\)/);
    expect(getRoute).toMatch(/session\?\.user\?\.id/);
    expect(readRoute).toMatch(/getServerSession\(authOptions\)/);
    expect(readRoute).toMatch(/session\?\.user\?\.id/);
  });
});
