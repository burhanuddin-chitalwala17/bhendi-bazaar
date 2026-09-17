/**
 * Contact us, server half: a message becomes one email to the store's inbox
 * (docs/specs/contact-us/). The reply address is the session's when signed in, never
 * the body's, and a guest must supply one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getServerSession = vi.fn();
const sendEmail = vi.fn();

vi.mock("next-auth", () => ({ getServerSession: () => getServerSession() }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@server/notifications/email.service", () => ({
  emailService: { sendContactMessage: (view: unknown) => sendEmail(view) },
}));

const { POST } = await import("@/app/api/contact/route");
const { getContactMessageEmailTemplate } = await import(
  "@server/notifications/templates/contactMessageEmail"
);

const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  );

const valid = { subject: "Sizing", message: "Does the kurta come in XL?" };

beforeEach(() => {
  getServerSession.mockReset().mockResolvedValue(null);
  sendEmail.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/contact", () => {
  it("emails a signed-in sender's message with the session's address, ignoring the body's", async () => {
    getServerSession.mockResolvedValue({
      user: { id: "u-1", name: "Aisha", email: "aisha@example.com" },
    });

    const response = await post({ ...valid, email: "spoofed@example.com" });

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith({
      subject: "Sizing",
      message: "Does the kurta come in XL?",
      replyEmail: "aisha@example.com",
      senderName: "Aisha",
      signedIn: true,
    });
  });

  it("does not ask a signed-in sender for an email", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u-1", email: "aisha@example.com" } });
    expect((await post(valid)).status).toBe(200);
  });

  it("uses a guest's typed email as the reply address", async () => {
    await post({ ...valid, email: "guest@example.com" });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ replyEmail: "guest@example.com", senderName: null, signedIn: false })
    );
  });

  it("refuses a guest with no email, on the email field, and sends nothing", async () => {
    const response = await post(valid);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual([expect.objectContaining({ path: "email" })]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses a missing subject", async () => {
    const response = await post({ message: valid.message, email: "guest@example.com" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details[0].path).toBe("subject");
  });

  it("reports a failed send instead of claiming success", async () => {
    sendEmail.mockRejectedValue(new Error("Resend down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post({ ...valid, email: "guest@example.com" });

    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/could not send/i);
  });
});

describe("the contact email", () => {
  it("escapes what the sender typed and keeps their line breaks", () => {
    const html = getContactMessageEmailTemplate({
      subject: "<b>hi</b>",
      message: "line one\n<script>alert(1)</script>",
      replyEmail: "guest@example.com",
      senderName: null,
      signedIn: false,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(html).toContain("line one<br />");
    expect(html).toContain("Guest");
  });
});
