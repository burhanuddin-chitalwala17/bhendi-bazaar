// The outbid notice once read `userId` off a shape that never carried it, so the
// in-app half was dead code that type-checked only in the author's head.
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@server/shared/prisma", () => ({ prisma: {} }));

const leaderBefore = vi.fn();
vi.mock("@server/bidding/bidding.repository", () => ({
  biddingRepository: { leaderBefore: (...args: unknown[]) => leaderBefore(...args) },
}));

const notifyUser = vi.fn();
vi.mock("@server/notifications/in-app.service", () => ({
  inAppNotificationService: { notifyUser: (input: unknown) => notifyUser(input) },
}));

const sendOutbidEmail = vi.fn();
vi.mock("@server/notifications/email.service", () => ({
  emailService: { sendOutbidEmail: (...args: unknown[]) => sendOutbidEmail(...args) },
}));

const { biddingService } = await import("@server/bidding/bidding.service");
const { NOTIFICATION_TYPE } = await import("@server/notifications/in-app.types");

const leader = {
  id: "bid-1",
  amountPaise: 50_000,
  placedAt: new Date("2026-09-20"),
  bidderName: "Previous Leader",
  bidderPhone: null,
  bidderEmail: null,
  isRegistered: true,
  userId: "user-1",
};

describe("notifyOutbid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyUser.mockResolvedValue({});
    sendOutbidEmail.mockResolvedValue(undefined);
    vi.spyOn(biddingService, "publicView").mockResolvedValue({
      product: { name: "Kashmiri Shawl" },
      highestBidPaise: 60_000,
      endAt: new Date("2026-09-30"),
    } as Awaited<ReturnType<typeof biddingService.publicView>>);
  });

  it("tells a signed-in previous leader in-app, even with no email to send to", async () => {
    leaderBefore.mockResolvedValue(leader);

    await biddingService["notifyOutbid"]("event-1", "bid-2", "kashmiri-shawl");

    expect(notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: NOTIFICATION_TYPE.BID_OUTBID,
        link: "/bid/kashmiri-shawl",
      })
    );
    expect(sendOutbidEmail).not.toHaveBeenCalled();
  });

  it("skips the in-app notice for a guest leader but still emails them", async () => {
    leaderBefore.mockResolvedValue({
      ...leader,
      userId: null,
      isRegistered: false,
      bidderEmail: "guest@example.com",
    });

    await biddingService["notifyOutbid"]("event-1", "bid-2", "kashmiri-shawl");

    expect(notifyUser).not.toHaveBeenCalled();
    expect(sendOutbidEmail).toHaveBeenCalledWith("guest@example.com", expect.anything());
  });
});
