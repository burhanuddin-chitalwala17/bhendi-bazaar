/**
 * Contact us, storefront half: WhatsApp as a link, and a subject + message form that
 * replaces the options in the same sheet and confirms there. A guest is also asked
 * for an email, because there is otherwise nobody to reply to.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const sendContactMessage = vi.fn();
vi.mock("@/services/contactApiClient", () => ({
  sendContactMessage: (values: unknown) => sendContactMessage(values),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { ContactSheet } = await import("@/components/support/contact-sheet");

function openForm(signedIn: boolean) {
  render(<ContactSheet open onOpenChange={() => {}} signedIn={signedIn} />);
  fireEvent.click(screen.getByRole("button", { name: /send a message/i }));
}

const subject = () => screen.getByPlaceholderText("Order, sizing, something else");
const message = () => screen.getByPlaceholderText("Tell us what you need help with.");
const email = () => screen.queryByPlaceholderText("you@example.com");
const send = () => fireEvent.click(screen.getByRole("button", { name: /send message/i }));

describe("ContactSheet", () => {
  it("offers WhatsApp and a message", () => {
    render(<ContactSheet open onOpenChange={() => {}} signedIn={false} />);

    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send a message/i })).toBeInTheDocument();
  });

  it("links WhatsApp to the store's number with an opening message, in a new tab", () => {
    render(<ContactSheet open onOpenChange={() => {}} signedIn={false} />);
    const link = screen.getByRole("link", { name: /whatsapp/i });

    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/918452959340\?text=/);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("is a bottom sheet on a phone that becomes a side panel on desktop", () => {
    render(<ContactSheet open onOpenChange={() => {}} signedIn={false} />);
    const sheet = document.querySelector('[data-slot="sheet-content"]');

    expect(sheet).toHaveAttribute("data-side", "adaptive");
    expect(sheet?.className).toContain("bottom-0");
    expect(sheet?.className).toContain("md:right-0");
  });

  it("shows a signed-in person only a subject and a message", () => {
    openForm(true);

    expect(subject()).toBeInTheDocument();
    expect(message()).toBeInTheDocument();
    expect(email()).toBeNull();
  });

  it("also asks a guest for an email", () => {
    openForm(false);
    expect(email()).toBeInTheDocument();
  });

  it("sends a signed-in message without an email and confirms in the same sheet", async () => {
    sendContactMessage.mockResolvedValue(undefined);
    openForm(true);

    fireEvent.change(subject(), { target: { value: "Sizing" } });
    fireEvent.change(message(), { target: { value: "Does the kurta come in XL?" } });
    send();

    await waitFor(() => expect(screen.getByText(/we have your message/i)).toBeInTheDocument());
    expect(sendContactMessage).toHaveBeenCalledWith({
      subject: "Sizing",
      message: "Does the kurta come in XL?",
    });
  });

  it("does not send a guest message with no email", async () => {
    openForm(false);

    fireEvent.change(subject(), { target: { value: "Sizing" } });
    fireEvent.change(message(), { target: { value: "Does the kurta come in XL?" } });
    send();

    await waitFor(() =>
      expect(screen.getByText(/please fix the highlighted fields/i)).toBeInTheDocument()
    );
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it("goes back to the options without closing", () => {
    openForm(true);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeInTheDocument();
  });
});
