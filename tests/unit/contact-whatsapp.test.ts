/** wa.me takes bare E.164 digits; a plus or a space in the path resolves to nothing. */
import { describe, expect, it } from "vitest";
import { whatsappSupportUrl } from "@/lib/support-contact";
import { SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_MESSAGE } from "@/lib/config";

describe("whatsappSupportUrl", () => {
  it("opens the store's number with the default opening line", () => {
    const url = new URL(whatsappSupportUrl());

    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/918452959340");
    expect(url.searchParams.get("text")).toBe(SUPPORT_WHATSAPP_MESSAGE);
  });

  it("never puts a plus or a space in the number", () => {
    expect(SUPPORT_WHATSAPP.digits).toMatch(/^\d+$/);
    expect(whatsappSupportUrl()).not.toMatch(/wa\.me\/\+/);
  });

  it("encodes the message rather than breaking the query", () => {
    expect(whatsappSupportUrl("Order #12 & size?")).toContain(
      "text=Order%20%2312%20%26%20size%3F"
    );
  });

  it("drops the query entirely for a blank message", () => {
    expect(whatsappSupportUrl("   ")).toBe("https://wa.me/918452959340");
  });
});
