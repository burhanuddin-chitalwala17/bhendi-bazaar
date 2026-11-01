/**
 * The Bhendi Bazaar team's form for a shop (product-form R10; ux.md "Admin edit / add for shop"):
 * the banner naming the shop, a reason the save cannot go without, the team's own words on the
 * save, and the reason carried to the server. Nothing is disabled (R13).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import type { ProductDetails, ProductFormInput } from "@/components/product/console/types";
import { TEAM_REASON_REQUIRED } from "@/lib/validation/schemas/product.schema";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: "p-1" }),
  usePathname: () => "/admin/products/p-1/edit",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/product/product-media-manager", () => ({ ProductMediaManager: () => null }));

const { ProductForm } = await import("@/components/shared/forms/product");
const org = { id: "org-1", name: "Noor Attar House", code: "NOOR", handle: "noor" };

const product: ProductDetails = {
  id: "p-1",
  slug: "emerald-abaya",
  name: "Emerald Abaya",
  description: "A soft emerald abaya.",
  price: 249_900,
  currency: "INR",
  category: { id: "cat-1", name: "Abaya" },
  tags: [],
  flags: [],
  stock: 10,
  lowStockThreshold: 10,
  weight: 0.6,
  media: [{ id: "m-1", kind: "IMAGE", ref: "https://cdn.example.com/1.jpg", isThumbnail: true, slot: null } as never],
  thumbnail: "https://cdn.example.com/1.jpg",
  org,
  stockLocations: [{ orgAddressId: "loc-1", locationName: "Shop", quantity: 10 }],
  createdAt: new Date("2026-10-01"),
  version: 3,
  lastEditedAt: null,
  lastEditedBy: null,
  teamEditedAt: null,
};

function renderTeamEdit(onSubmit: (data: ProductFormInput) => Promise<unknown>) {
  return render(
    <ProductForm
      product={product}
      categories={[{ id: "cat-1", name: "Abaya" }]}
      orgs={[org]}
      locations={[{ id: "loc-1", name: "Shop", city: "Mumbai", pincode: "400003", isActive: true }]}
      onSubmit={onSubmit as never}
      onCancel={vi.fn()}
      uploadEndpoints={{ token: "/t", confirm: "/c" }}
      team={{ shopName: org.name }}
    />,
  );
}

beforeEach(() => localStorage.clear());

describe("the team edits for a shop (R10)", () => {
  it("names the shop, asks why, and says 'Save for shop' — nothing disabled", () => {
    const { container } = renderTeamEdit(vi.fn());
    expect(screen.getByText("Editing for Noor Attar House. The shop will see ‘Edited by Bhendi Bazaar team’.")).toBeTruthy();
    expect(screen.getByLabelText(/Why are you changing this\?/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save for shop" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(container.querySelectorAll("[disabled]")).toHaveLength(0);
  });

  it("a save without a reason sends nothing and says why under the reason (Q22)", async () => {
    const onSubmit = vi.fn();
    renderTeamEdit(onSubmit);
    fireEvent.click(screen.getByRole("button", { name: "Save for shop" }));
    expect(await screen.findByText(TEAM_REASON_REQUIRED)).toBeTruthy();
    expect(TEAM_REASON_REQUIRED).toBe("Say why — the shop will read it.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("carries the reason and the version it opened at, and tells the team the shop will see it", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ...product, version: 4 });
    renderTeamEdit(onSubmit);
    fireEvent.change(screen.getByLabelText(/Why are you changing this\?/), { target: { value: "Shop asked to fix the price" } });
    fireEvent.click(screen.getByRole("button", { name: "Save for shop" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ reason: "Shop asked to fix the price", seenVersion: 3 });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved. Noor Attar House will see what changed."));
  });

  it("keeps no device draft: one admin's device serves many shops", async () => {
    renderTeamEdit(vi.fn());
    fireEvent.change(screen.getByLabelText(/^Price \(₹\)/), { target: { value: "2299" } });
    // Past the draft's one-second debounce, which is when a shop's form would have written it.
    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(localStorage.getItem("product-edit-draft:p-1")).toBeNull();
  });
});

describe("the team adds for a shop, in the shop's steps (R10)", () => {
  it("'Put on sale for shop' without a reason sends nothing and the reason's error stays in sight (Q22)", async () => {
    const onSubmit = vi.fn();
    render(
      <ProductForm
        categories={[{ id: "cat-1", name: "Abaya" }]}
        orgs={[org]}
        locations={[{ id: "loc-1", name: "Shop", city: "Mumbai", pincode: "400003", isActive: true }]}
        onSubmit={onSubmit as never}
        onCancel={vi.fn()}
        uploadEndpoints={{ token: "/t", confirm: "/c" } as never}
        team={{ shopName: org.name }}
      />,
    );
    // The reason has no step of its own; it must still be seen from wherever the save lands.
    fireEvent.click(screen.getByRole("button", { name: /^Review/ }));
    fireEvent.click(screen.getByRole("button", { name: "Put on sale for shop" }));
    expect(await screen.findByText("Say why — the shop will read it.")).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
