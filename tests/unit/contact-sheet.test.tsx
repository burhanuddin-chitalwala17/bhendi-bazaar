/**
 * Contact us, storefront half: two options, WhatsApp as a link, and a message form that
 * replaces the options in the same sheet and confirms there (spec R2–R4, R6).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const sendContactMessage = vi.fn();
vi.mock("@/services/contactApiClient", () => ({
  sendContactMessage: (values: unknown) => sendContactMessage(values),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { ContactSheet } = await import("@/components/support/contact-sheet");

function renderSheet(sender?: { name?: string | null; email?: string | null }) {
  return render(<ContactSheet open onOpenChange={() => {}} sender={sender} />);
}

describe("ContactSheet", () => {
  it("offers exactly the two options", () => {
    renderSheet();

    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send a message/i })).toBeInTheDocument();
  });

  it("links WhatsApp to the store's number with an opening message, in a new tab", () => {
    renderSheet();
    const link = screen.getByRole("link", { name: /whatsapp/i });

    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/918452959340\?text=/);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("asks a guest for their name and email", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /send a message/i }));

    expect(screen.getByPlaceholderText("Your name")).not.toHaveAttribute("readonly");
    expect(screen.getByPlaceholderText("you@example.com")).not.toHaveAttribute("readonly");
  });

  it("shows a signed-in person's account details read-only", () => {
    renderSheet({ name: "Aisha", email: "aisha@example.com" });
    fireEvent.click(screen.getByRole("button", { name: /send a message/i }));

    const email = screen.getByPlaceholderText("you@example.com");
    expect(email).toHaveValue("aisha@example.com");
    expect(email).toHaveAttribute("readonly");
  });

  it("sends the message and confirms in the same sheet", async () => {
    sendContactMessage.mockResolvedValue(undefined);
    renderSheet({ name: "Aisha", email: "aisha@example.com" });
    fireEvent.click(screen.getByRole("button", { name: /send a message/i }));

    fireEvent.change(screen.getByPlaceholderText("Tell us what you need help with."), {
      target: { value: "Does the kurta come in XL?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(screen.getByText(/we have your message/i)).toBeInTheDocument());
    expect(sendContactMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Does the kurta come in XL?", email: "aisha@example.com" })
    );
  });

  it("does not send a message the schema refuses", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /send a message/i }));
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() =>
      expect(screen.getByText(/please fix the highlighted fields/i)).toBeInTheDocument()
    );
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it("goes back to the options without closing", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /send a message/i }));
    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeInTheDocument();
  });
});
