/**
 * Regression: the guest checkout form validates against a schema requiring `id`,
 * but no id field is registered. Without an `id` default the form stayed invalid
 * forever, onAddressChange never fired, and shipping rates never loaded for guests.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { GuestAddress, guestAddressSchema } from "@/containers/checkoutContainer/components/GuestAddress";

const filledForm: Record<string, string> = {
  fullName: "Farida Chitalwala",
  mobile: "9930571034",
  email: "someone@example.com",
  addressLine1: "204, Najmi building, Khambalpada Rd",
  city: "Thane",
  state: "Maharashtra",
  pincode: "421201",
  country: "India",
};

function fill(container: HTMLElement, fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) {
    const input = container.querySelector(`input[name="${name}"]`);
    if (!input) throw new Error(`No input named ${name}`);
    fireEvent.change(input, { target: { value } });
  }
}

describe("GuestAddress", () => {
  it("reports the address once every required field is filled", async () => {
    const onAddressChange = vi.fn();
    const { container } = render(<GuestAddress onAddressChange={onAddressChange} />);

    fill(container, filledForm);

    await waitFor(() => expect(onAddressChange).toHaveBeenCalled());
    expect(onAddressChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "", city: "Thane", pincode: "421201" })
    );
  });

  // A guest has no account to fall back to for the confirmation email, so unlike
  // the address-book form this one holds the address back until email is filled.
  it("withholds the address while email is blank, then reports it once filled", async () => {
    const onAddressChange = vi.fn();
    const { container } = render(<GuestAddress onAddressChange={onAddressChange} />);

    const { email: _email, ...withoutEmail } = filledForm;
    fill(container, withoutEmail);
    expect(onAddressChange).not.toHaveBeenCalled();

    fill(container, { email: filledForm.email });
    await waitFor(() => expect(onAddressChange).toHaveBeenCalled());
  });
});

describe("guestAddressSchema", () => {
  it("rejects a malformed email", () => {
    expect(guestAddressSchema.safeParse({ ...filledForm, id: "", email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a mobile that is not 10 digits", () => {
    expect(guestAddressSchema.safeParse({ ...filledForm, id: "", mobile: "12345" }).success).toBe(false);
  });
});
