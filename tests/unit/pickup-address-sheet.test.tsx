/**
 * A pickup address is created over the product form, comes back selected, and nothing typed is
 * lost (seller-onboarding U5; R8, A4; D11; Q12, Q26, Q29). The real form and sheet; only the
 * network and the gallery are stubbed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api-error";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgId: "org-1" }),
  usePathname: () => "/org/org-1/products/new",
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: (m: string) => toastSuccess(m) } }));
vi.mock("@/components/product/product-media-manager", () => ({ ProductMediaManager: () => null }));
const save = vi.fn();
vi.mock("@/components/org/orgLocationsApiClient", () => ({
  orgLocationsApiClient: { save: (...args: unknown[]) => save(...args) },
}));

const { ProductForm } = await import("@/components/shared/forms/product");
const org = { id: "org-1", name: "Noor Attar House", code: "NOOR", handle: "noor" };
const chip = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label.replace("&", "\\&")}`) });
const saved = { id: "loc-9", name: "Main shop", city: "Mumbai", pincode: "400003", isActive: true };

function renderForm() {
  render(
    <ProductForm
      categories={[{ id: "cat-1", name: "Abaya" }]}
      orgs={[org]}
      locations={[]}
      onSubmit={vi.fn() as never}
      onCancel={vi.fn()}
      uploadEndpoints={{ presign: "/p", confirm: "/c" } as never}
    />,
  );
}

function openSheetWithAProductTyped() {
  fireEvent.click(chip("What it is"));
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Emerald Abaya" } });
  fireEvent.click(chip("Price & stock"));
  fireEvent.change(screen.getByLabelText(/^Price \(₹\)/), { target: { value: "2499" } });
  fireEvent.click(screen.getByRole("button", { name: /Add location/ }));
}

function fillAddress(name = "Main shop") {
  fireEvent.change(screen.getByLabelText(/^Location name/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/^Pickup contact/), { target: { value: "Hussain Noor" } });
  fireEvent.change(screen.getByLabelText(/^Contact phone/), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByLabelText(/^Address line 1/), { target: { value: "12 Mohammed Ali Road" } });
  fireEvent.change(screen.getByLabelText(/^City/), { target: { value: "Mumbai" } });
  fireEvent.change(screen.getByLabelText(/^State/), { target: { value: "Maharashtra" } });
  fireEvent.change(screen.getByLabelText(/^Pincode/), { target: { value: "400003" } });
}

const saveButton = (name: string | RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  save.mockReset();
  toastSuccess.mockReset();
});

describe("Add pickup address over the product form (A4)", () => {
  it("opens as a sheet titled by ux.md, never on its own", () => {
    renderForm();
    fireEvent.click(chip("Price & stock"));
    expect(screen.queryByText("Add pickup address")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Add location/ }));
    expect(screen.getByRole("dialog", { name: "Add pickup address" })).toBeInTheDocument();
    expect(saveButton("Save address")).toBeEnabled();
  });

  it("returns the address selected, toasts, and keeps what was typed in the product form", async () => {
    save.mockResolvedValue(saved);
    renderForm();
    openSheetWithAProductTyped();
    fillAddress();
    fireEvent.click(saveButton("Save address"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toastSuccess).toHaveBeenCalledWith("Pickup address added");
    expect(screen.getByLabelText("Stock at Main shop")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Price \(₹\)/)).toHaveValue(2499);
    fireEvent.click(chip("What it is"));
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Emerald Abaya");
  });

  it.each([
    ["a network drop", new TypeError("Failed to fetch")],
    ["a server fault", new ApiError("Something went wrong", 500, [])],
  ])("on %s says the form is safe, keeps the sheet's values, and Try again saves", async (_, failure) => {
    save.mockRejectedValueOnce(failure).mockResolvedValueOnce(saved);
    renderForm();
    openSheetWithAProductTyped();
    fillAddress();
    fireEvent.click(saveButton("Save address"));

    expect(await screen.findByText("Couldn't save. Your form is safe.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Location name/)).toHaveValue("Main shop");
    fireEvent.click(saveButton("Try again"));
    await waitFor(() => expect(screen.getByLabelText("Stock at Main shop")).toBeInTheDocument());
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("puts a duplicate name's refusal under the name, in ux.md's words (Q29)", async () => {
    const refusal = "You already have 'Main shop'. Use another name.";
    save.mockRejectedValue(new ApiError(refusal, 409, [{ path: "name", message: refusal }]));
    renderForm();
    openSheetWithAProductTyped();
    fillAddress("main shop");
    fireEvent.click(saveButton("Save address"));

    expect(await screen.findByText(refusal)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Location name/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Couldn't save. Your form is safe.")).toBeNull();
  });

  it("says Saving…, then Still saving… after 3 s, and a second press sends nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let finish: (value: unknown) => void = () => {};
      save.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      renderForm();
      openSheetWithAProductTyped();
      fillAddress();
      fireEvent.click(saveButton("Save address"));

      const busy = await screen.findByRole("button", { name: "Saving…" });
      expect(busy).toBeEnabled();
      fireEvent.click(busy);
      await act(async () => { vi.advanceTimersByTime(3_000); });
      expect(screen.getByRole("button", { name: "Still saving…" })).toBeInTheDocument();
      expect(save).toHaveBeenCalledTimes(1);
      await act(async () => { finish(saved); });
    } finally {
      vi.useRealTimers();
    }
  });
});
