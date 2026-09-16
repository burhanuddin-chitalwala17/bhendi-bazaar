/**
 * Contact us, server half (docs/specs/contact-us/).
 *
 * The cases that matter are the ones where the body and the stored row disagree on
 * purpose: a signed-in sender's name and email come from the account, whatever was
 * posted (TRD D3), and the flood guard refuses on its boundary (TRD D6).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUser = vi.fn();
const create = vi.fn();
const countRecent = vi.fn();
const setStatusRow = vi.fn();
const recordAdminAction = vi.fn();

vi.mock("@server/shared/prisma", () => ({
  prisma: { user: { findUnique: (args: unknown) => findUser(args) } },
}));
vi.mock("@server/support/contact.repository", () => ({
  contactRepository: {
    create: (row: unknown) => create(row),
    countRecent: (key: unknown, since: Date) => countRecent(key, since),
    setStatus: (id: string, status: string) => setStatusRow(id, status),
  },
}));
vi.mock("@server/shared/audit/audit.service", () => ({
  recordAdminAction: (entry: unknown) => recordAdminAction(entry),
}));

const { contactService, CONTACT_FLOOD_LIMIT, CONTACT_FLOOD_WINDOW_MS } = await import(
  "@server/support/contact.service"
);
const { contactMessageSchema, updateContactMessageSchema } = await import(
  "@/lib/validation/schemas/contact.schema"
);

const input = {
  name: "Someone Else",
  email: "spoofed@example.com",
  subject: "  Sizing  ",
  message: "Does the kurta come in XL?",
};

beforeEach(() => {
  findUser.mockReset().mockResolvedValue(null);
  create.mockReset().mockResolvedValue("msg-1");
  countRecent.mockReset().mockResolvedValue(0);
  setStatusRow.mockReset().mockResolvedValue(1);
  recordAdminAction.mockReset();
});

describe("contactMessageSchema", () => {
  it("accepts a message with an empty subject, as an untouched input sends it", () => {
    expect(contactMessageSchema.safeParse({ ...input, subject: "" }).success).toBe(true);
  });

  it("refuses a message too short to act on, attributed to the field", () => {
    const result = contactMessageSchema.safeParse({ ...input, message: "help" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["message"]);
  });

  it("refuses a message over 2000 characters", () => {
    expect(
      contactMessageSchema.safeParse({ ...input, message: "x".repeat(2001) }).success
    ).toBe(false);
  });

  it("refuses an invalid email", () => {
    expect(contactMessageSchema.safeParse({ ...input, email: "nope" }).success).toBe(false);
  });

  it("lets an admin set a known status and nothing else", () => {
    expect(updateContactMessageSchema.safeParse({ status: "RESOLVED" }).success).toBe(true);
    expect(updateContactMessageSchema.safeParse({ status: "DELETED" }).success).toBe(false);
  });
});

describe("submitting", () => {
  it("stores what a guest typed, with no account attached", async () => {
    await contactService.submit(input, null);

    expect(findUser).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      userId: null,
      name: "Someone Else",
      email: "spoofed@example.com",
      subject: "Sizing",
      message: input.message,
    });
  });

  it("replaces a signed-in sender's posted name and email with the account's", async () => {
    findUser.mockResolvedValue({ id: "u-1", name: "Aisha", email: "aisha@example.com" });

    await contactService.submit(input, "u-1");

    expect(create.mock.calls[0][0]).toMatchObject({
      userId: "u-1",
      name: "Aisha",
      email: "aisha@example.com",
    });
  });

  it("keeps the typed name only when the account has none", async () => {
    findUser.mockResolvedValue({ id: "u-1", name: null, email: "aisha@example.com" });

    await contactService.submit(input, "u-1");

    expect(create.mock.calls[0][0]).toMatchObject({
      name: "Someone Else",
      email: "aisha@example.com",
    });
  });

  it("treats a session for a deleted account as a guest, so the foreign key holds", async () => {
    await contactService.submit(input, "u-gone");
    expect(create.mock.calls[0][0].userId).toBeNull();
  });

  it("stores a blank subject as null rather than an empty string", async () => {
    await contactService.submit({ ...input, subject: "   " }, null);
    expect(create.mock.calls[0][0].subject).toBeNull();
  });
});

describe("the flood guard", () => {
  const now = new Date("2026-09-16T12:00:00Z");

  it("allows the last message under the limit", async () => {
    countRecent.mockResolvedValue(CONTACT_FLOOD_LIMIT - 1);
    await expect(contactService.submit(input, null, now)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalled();
  });

  it("refuses at the limit with a 429 on the message field, and writes nothing", async () => {
    countRecent.mockResolvedValue(CONTACT_FLOOD_LIMIT);

    await expect(contactService.submit(input, null, now)).rejects.toMatchObject({
      status: 429,
      field: "message",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("counts a guest by email over the window ending now", async () => {
    await contactService.submit(input, null, now);

    expect(countRecent).toHaveBeenCalledWith(
      { email: "spoofed@example.com" },
      new Date(now.getTime() - CONTACT_FLOOD_WINDOW_MS)
    );
  });

  it("counts a signed-in sender by account, so changing the email does not reset it", async () => {
    findUser.mockResolvedValue({ id: "u-1", name: "Aisha", email: "aisha@example.com" });

    await contactService.submit(input, "u-1", now);

    expect(countRecent.mock.calls[0][0]).toEqual({ userId: "u-1" });
  });
});

describe("resolving", () => {
  it("records who resolved it, after the write", async () => {
    await contactService.setStatus("msg-1", "RESOLVED", "admin-1");

    expect(setStatusRow).toHaveBeenCalledWith("msg-1", "RESOLVED");
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin-1",
        action: "CONTACT_MESSAGE_RESOLVED",
        resource: "ContactMessage",
        resourceId: "msg-1",
      })
    );
  });

  it("records a reopen as its own action", async () => {
    await contactService.setStatus("msg-1", "NEW", "admin-1");
    expect(recordAdminAction.mock.calls[0][0].action).toBe("CONTACT_MESSAGE_REOPENED");
  });

  it("is a 404 for a message that no longer exists, and audits nothing", async () => {
    setStatusRow.mockResolvedValue(0);

    await expect(contactService.setStatus("gone", "RESOLVED", "admin-1")).rejects.toMatchObject({
      status: 404,
    });
    expect(recordAdminAction).not.toHaveBeenCalled();
  });
});
