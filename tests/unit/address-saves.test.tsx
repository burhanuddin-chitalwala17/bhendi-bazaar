/**
 * Two address saves that went wrong silently: editing a profile address added a second one,
 * and a failed add in checkout closed the dialog as if it had saved.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DeliveryAddress } from "@/domain/profile";

const { api } = vi.hoisted(() => ({
  api: { addAddress: vi.fn(), updateAddress: vi.fn(), deleteAddress: vi.fn(), getAddresses: vi.fn() },
}));
vi.mock("@/components/profile/addressApiClient", () => ({ addressApiClient: api }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { AuthenticatedAddress } = await import("@/components/checkout/components/AuthenticatedAddress");
const { ProfileSections } = await import("@/components/profile/profile-sections");

const saved: DeliveryAddress = {
  id: "addr-1",
  label: "Home",
  fullName: "Farida Chitalwala",
  mobile: "9930571034",
  email: "someone@example.com",
  addressLine1: "204, Najmi building, Khambalpada Rd",
  addressLine2: "",
  city: "Thane",
  state: "Maharashtra",
  pincode: "421201",
  country: "India",
};

beforeEach(() => vi.clearAllMocks());

describe("address saves", () => {
  it("editing a saved profile address updates it rather than adding another", async () => {
    api.updateAddress.mockResolvedValue(true);
    render(
      <ProfileSections
        data={{ user: { id: "u1", name: "B", email: "b@example.com" }, profile: { addresses: [saved], profilePic: null } } as never}
        orders={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    // The profile card has its own Edit; the address dialog's is the last one rendered.
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" }).at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(api.updateAddress).toHaveBeenCalledWith("addr-1", expect.objectContaining({ city: "Thane" })));
    expect(api.addAddress).not.toHaveBeenCalled();
  });

  it("a failed add in checkout keeps the dialog open and says why", async () => {
    const failure = new Error("Could not add address");
    const onAddressAdded = vi.fn().mockRejectedValue(failure);
    // useServerForm rethrows after showing the error; from a DOM submit nothing awaits it.
    const swallow = (reason: unknown) => { if (reason !== failure) throw reason; };
    process.on("unhandledRejection", swallow);
    const onAddressChange = vi.fn();
    const { container } = render(
      <AuthenticatedAddress
        selectedAddress={null}
        addresses={[]}
        onAddressChange={onAddressChange}
        onAddressAdded={onAddressAdded}
        onAddressUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    for (const name of ["fullName", "mobile", "email", "addressLine1", "city", "state", "pincode"] as const) {
      const input = container.querySelector(`input[name="${name}"]`);
      if (!input) throw new Error(`No input named ${name}`);
      fireEvent.change(input, { target: { value: saved[name] } });
    }
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onAddressAdded).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add address");
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(onAddressChange).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    process.off("unhandledRejection", swallow);
  });
});
