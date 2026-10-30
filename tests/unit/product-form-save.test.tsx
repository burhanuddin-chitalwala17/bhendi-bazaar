/**
 * A valid new product through the steps (product-form U1): a server refusal on a field opens the
 * step that holds it, and "Add another" keeps a pickup location added while the form was open.
 * The gallery and location seams are stubbed: their own rules are pinned in product-form-steps.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api-error";
import type { ProductFormInput } from "@/components/product/console/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgId: "org-1" }),
  usePathname: () => "/org/org-1/products/new",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/product/product-media-manager", () => ({
  ProductMediaManager: ({ onChange }: { onChange: (media: unknown[]) => void }) => (
    <button type="button" onClick={() => onChange([{ kind: "IMAGE", ref: "https://cdn.example.com/1.jpg", isThumbnail: true, slot: null }])}>
      stub: add a cover photo
    </button>
  ),
}));
vi.mock("@/components/org/location-form", () => ({
  LocationForm: ({ onDone }: { onDone: (location: unknown) => void }) => (
    <form onSubmit={(event) => { event.preventDefault(); onDone({ id: "loc-2", name: "Godown", city: "Mumbai", pincode: "400009", isActive: true }); }}>
      <button type="submit">stub: save location</button>
    </form>
  ),
}));

const { ProductForm } = await import("@/components/shared/forms/product");
const org = { id: "org-1", name: "Noor Attar House", code: "NOOR", handle: "noor" };
const stepTitle = () => screen.getByTestId("step-title").textContent;
const chip = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label.replace("&", "\\&")}`) });

function renderForm(onSubmit: (data: ProductFormInput) => Promise<unknown>, locations = [{ id: "loc-1", name: "Shop", city: "Mumbai", pincode: "400003", isActive: true }]) {
  render(
    <ProductForm
      categories={[{ id: "cat-1", name: "Abaya" }]}
      orgs={[org]}
      locations={locations}
      onSubmit={onSubmit as never}
      onCancel={vi.fn()}
      uploadEndpoints={{ presign: "/p", confirm: "/c" } as never}
    />,
  );
}

async function fillValidProduct() {
  fireEvent.click(chip("Photos and video"));
  fireEvent.click(screen.getByRole("button", { name: "stub: add a cover photo" }));
  fireEvent.click(chip("What it is"));
  fireEvent.click(screen.getByRole("button", { name: /^Category/ }));
  fireEvent.click((await screen.findAllByRole("button", { name: "Abaya" }))[0]);
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Emerald Abaya" } });
  fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "A soft emerald abaya." } });
  fireEvent.click(chip("Price & stock"));
  fireEvent.change(screen.getByLabelText(/^Price \(₹\)/), { target: { value: "2499" } });
  fireEvent.change(screen.getByLabelText(/^Packed weight/), { target: { value: "0.6" } });
  fireEvent.click(chip("Review"));
}

describe("saving a new product", () => {
  it("opens Price & stock and More options when the server refuses the SKU (spec R4, Q5; ux Refused)", async () => {
    const refusal = "Your product 'Emerald Abaya' already uses this code.";
    const onSubmit = vi.fn(async () => {
      throw new ApiError(refusal, 409, [{ path: "sku", message: refusal }]);
    });
    renderForm(onSubmit);
    await fillValidProduct();
    fireEvent.click(screen.getByRole("button", { name: "Put on sale" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(stepTitle()).toBe("Price & stock"));
    expect(screen.getByLabelText("SKU (your own code)")).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps a pickup location added mid-form when the seller taps Add another (ux Empty, Q16)", async () => {
    const saved: ProductFormInput[] = [];
    const onSubmit = vi.fn(async (data: ProductFormInput) => {
      saved.push(data);
      return { id: `p-${saved.length}`, slug: "emerald-abaya", name: data.name };
    });
    renderForm(onSubmit, []);
    fireEvent.click(chip("Price & stock"));
    expect(screen.getByText("Where is this kept? Add your shop address once.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add location/ }));
    fireEvent.click(await screen.findByRole("button", { name: "stub: save location" }));
    // Saving the location is the dialog's own submit; it must not move the outer form on.
    expect(stepTitle()).toBe("Price & stock");

    await fillValidProduct();
    fireEvent.click(screen.getByRole("button", { name: "Put on sale" }));
    expect(await screen.findByText("On sale now")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add another" }));

    expect(stepTitle()).toBe("Photos and video");
    expect(screen.queryByRole("button", { name: /✓/ })).toBeNull();
    await fillValidProduct();
    fireEvent.click(screen.getByRole("button", { name: "Put on sale" }));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1].stockLocations.map((row) => row.orgAddressId)).toEqual(["loc-2"]);
  });
});
