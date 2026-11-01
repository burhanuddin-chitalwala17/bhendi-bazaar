/**
 * Editing a product (product-form U4): the overview of sections (R7), the device draft and the
 * leave sheet (R8), and a refused save rebased onto the latest product (R9). The gallery is
 * stubbed; its own rules are pinned in product-form-steps.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api-error";
import type { ProductDetails, ProductFormInput } from "@/components/product/console/types";
import { versionConflictMessage, TEAM_EDITOR, VERSION_FIELD, STOCK_FIELD } from "@server/catalog/product-edit";
import { EDIT_CONFLICT, rebase, staleStockMessage } from "@/components/shared/forms/product/edit-overview";
import { leaveBody } from "@/components/shared/forms/product/product-steps";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  useParams: () => ({ orgId: "org-1", id: "p-1" }),
  usePathname: () => "/org/org-1/products/p-1/edit",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/product/product-media-manager", () => ({ ProductMediaManager: () => null }));

const { ProductForm } = await import("@/components/shared/forms/product");
const org = { id: "org-1", name: "Noor Attar House", code: "NOOR", handle: "noor" };
const location = { id: "loc-1", name: "Shop", city: "Mumbai", pincode: "400003", isActive: true };

function aProduct(over: Partial<ProductDetails> = {}): ProductDetails {
  return {
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
    version: 0,
    lastEditedAt: null,
    lastEditedBy: null,
    teamEditedAt: null,
    ...over,
  };
}

function renderEdit(product: ProductDetails, onSubmit: (data: ProductFormInput) => Promise<unknown>) {
  const props = {
    categories: [{ id: "cat-1", name: "Abaya" }],
    orgs: [org],
    locations: [location],
    onSubmit: onSubmit as never,
    onCancel: vi.fn(),
    uploadEndpoints: { presign: "/p", confirm: "/c" } as never,
  };
  const view = render(<ProductForm product={product} {...props} />);
  return { ...view, rerender: (next: ProductDetails) => view.rerender(<ProductForm product={next} {...props} />) };
}

const card = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label.replace("&", "\\&")}`) });
const priceInput = () => screen.getByLabelText(/^Price \(₹\)/) as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  refresh.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("the conflict wording (D7, ux copy deck Conflict)", () => {
  const at = new Date("2026-10-30T10:00:00Z");
  const now = new Date("2026-10-30T10:02:30Z");
  it("names the team, never the admin, while the team's save is the latest (spec A6)", () => {
    const edit = { lastEditedById: "admin-1", lastEditedAt: at, teamEditedAt: at, lastEditedByName: "Asha Admin" };
    expect(versionConflictMessage(edit, "member-1", now)).toBe(
      `${TEAM_EDITOR} changed this product 2 min ago. We loaded the latest and kept your changes — check and save.`,
    );
  });
  it("names the other member, or 'You' for the same person in another tab", () => {
    const edit = { lastEditedById: "member-2", lastEditedAt: at, teamEditedAt: null, lastEditedByName: "Zahra" };
    expect(versionConflictMessage(edit, "member-1", now)).toMatch(/^Zahra changed this product 2 min ago\./);
    expect(versionConflictMessage(edit, "member-2", now)).toMatch(/^You changed this product/);
  });
});

describe("rebase (D8)", () => {
  const latest = { price: 2299, name: "New name", stockLocations: [{ orgAddressId: "loc-1", quantity: 8, seenQuantity: 8 }] } as ProductFormInput;
  const mine = { price: 1999, name: "Old name", stockLocations: [{ orgAddressId: "loc-1", quantity: 12, seenQuantity: 10 }] } as ProductFormInput;

  it("lays only the seller's changed fields over the latest, and compares stock against what is stored now", () => {
    const { values, kept } = rebase(latest, mine, ["price", "stockLocations"], EDIT_CONFLICT.VERSION);
    expect(values.price).toBe(1999);
    expect(values.name).toBe("New name");
    expect(values.stockLocations).toEqual([{ orgAddressId: "loc-1", quantity: 12, seenQuantity: 8 }]);
    expect(kept).toEqual(["price", "stockLocations"]);
  });

  it("inside facts, re-applies only the answers the seller changed: the team's other answer stands", () => {
    const team = { ...latest, facts: { fabric: "linen", sleeve: "short" } } as ProductFormInput;
    const seller = { ...mine, facts: { fabric: "cotton", sleeve: "long" } } as ProductFormInput;
    const { values, kept, applied } = rebase(team, seller, ["facts.sleeve"], EDIT_CONFLICT.VERSION);
    expect(values.facts).toEqual({ fabric: "linen", sleeve: "long" });
    expect(team.facts).toEqual({ fabric: "linen", sleeve: "short" });
    expect(kept).toEqual(["facts"]);
    expect(applied).toEqual(["facts.sleeve"]);
  });

  it("after a sale, keeps the stored stock: the sale is the newer fact (ux Edit overview, Stale)", () => {
    const { values, kept } = rebase(latest, mine, ["price", "stockLocations"], EDIT_CONFLICT.STOCK);
    expect(values.stockLocations[0].quantity).toBe(8);
    expect(kept).toEqual(["price"]);
    expect(staleStockMessage(10, 8)).toBe("2 sold while you were editing. Stock is now 8.");
  });
});

describe("the edit overview (spec R7)", () => {
  it("opens at one card per section with its summary; a card opens that section alone", () => {
    renderEdit(aProduct(), vi.fn());
    expect(screen.getByText("Tap a section to change it.")).toBeInTheDocument();
    expect(card("Price & stock")).toHaveTextContent("₹2,499 · 10 in stock");
    expect(card("What it is")).toHaveTextContent("Abaya · Emerald Abaya");
    fireEvent.click(card("Price & stock"));
    expect(screen.getByTestId("section-title")).toHaveTextContent("Price & stock");
    expect(priceInput().closest("section")).not.toHaveAttribute("hidden");
    expect(screen.getByLabelText(/^Name/).closest("section")).toHaveAttribute("hidden");
  });

  it("shows five cards, Review last, which opens how buyers see it (ux Edit overview, First use)", () => {
    renderEdit(aProduct(), vi.fn());
    expect(screen.getByRole("list", { name: "Sections" }).querySelectorAll("li")).toHaveLength(5);
    fireEvent.click(card("Review"));
    expect(screen.getByTestId("section-title")).toHaveTextContent("Review");
    expect(screen.getByText("This is how buyers will see it.")).toBeInTheDocument();
  });

  it("disables nothing anywhere in the edit form (spec A8)", () => {
    const { container } = renderEdit(aProduct(), vi.fn());
    for (const section of ["Photos and video", "What it is", "Price & stock", "Details", "Review"]) fireEvent.click(card(section));
    expect(container.querySelectorAll("[disabled]")).toHaveLength(0);
  });
});

describe("leaving with changes (spec R8, A5)", () => {
  it("editing the price from the overview and going back asks 'Leave without saving?'", async () => {
    renderEdit(aProduct(), vi.fn());
    fireEvent.click(card("Price & stock"));
    fireEvent.change(priceInput(), { target: { value: "2299" } });
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByText("Leave without saving?")).toBeInTheDocument();
    expect(screen.getByText("Your changes to Price & stock will be lost.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByText("Leave without saving?")).toBeNull());
    expect(priceInput().value).toBe("2299");
  });

  it("names every section holding a change", () => {
    expect(leaveBody(["what", "price", "details"])).toBe("Your changes to What it is, Price & stock and Details will be lost.");
  });

  it("after a save, gives back the history entry it pushed, so one back leaves (R8)", async () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    renderEdit(aProduct(), vi.fn(async () => aProduct({ version: 1 })));
    fireEvent.click(card("Price & stock"));
    fireEvent.change(priceInput(), { target: { value: "2299" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByText("Leave without saving?")).toBeNull();
    back.mockRestore();
  });

  it("asks nothing when nothing changed", async () => {
    renderEdit(aProduct(), vi.fn());
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByText("Leave without saving?")).toBeNull();
  });
});

describe("a device draft on edit (spec R8, D9)", () => {
  const key = "product-edit-draft:p-1";

  it("restores a recent draft with 'Discard', and saves it against the version it was typed on", async () => {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now() - 60_000, values: { name: "Typed name" }, meta: { seenVersion: 0 } }));
    const onSubmit = vi.fn(async (_data: ProductFormInput) => aProduct({ version: 4 }));
    renderEdit(aProduct({ version: 3 }), onSubmit);
    expect(await screen.findByText(/^We kept what you typed at /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(card("What it is")).toHaveTextContent("Typed name");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // The draft's own version, not the page's: a draft over a product changed since is refused (D6).
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Typed name", seenVersion: 0 });
  });

  it("asks 'Use it?' of a draft older than a week instead of restoring it (ux Stale)", async () => {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now() - 8 * 24 * 3600_000, values: { name: "Old typing" }, meta: { seenVersion: 0 } }));
    renderEdit(aProduct(), vi.fn());
    expect(await screen.findByText(/^We kept what you typed on .+\. Use it\?$/)).toBeInTheDocument();
    expect(card("What it is")).toHaveTextContent("Emerald Abaya");
    fireEvent.click(screen.getByRole("button", { name: "Use it" }));
    await waitFor(() => expect(card("What it is")).toHaveTextContent("Old typing"));
  });
});

describe("a save over a product someone else changed (spec R9, A6)", () => {
  it("a draft typed at v3 touching only the description never undoes the team's v4 price", async () => {
    const words = "Bhendi Bazaar team changed this product 2 min ago. We loaded the latest and kept your changes — check and save.";
    const first = renderEdit(aProduct({ version: 3 }), vi.fn());
    fireEvent.click(card("What it is"));
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "Now in a softer crepe." } });

    await waitFor(() => expect(localStorage.getItem("product-edit-draft:p-1")).not.toBeNull(), { timeout: 3000 });
    first.unmount();

    const onSubmit = vi
      .fn<(data: ProductFormInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError(words, 409, [{ path: VERSION_FIELD, message: words }]));
    const v4 = () => aProduct({ version: 4, price: 229_900, teamEditedAt: new Date(), lastEditedAt: new Date() });
    const { rerender } = renderEdit(v4(), onSubmit);
    expect(await screen.findByText(/^We kept what you typed at /)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ seenVersion: 3, description: "Now in a softer crepe." });
    await waitFor(() => expect(refresh).toHaveBeenCalled());

    rerender(v4());
    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(card("Price & stock")).toHaveTextContent("₹2,299");
    expect(card("Price & stock")).not.toHaveTextContent("Your change kept");
    expect(card("What it is")).toHaveTextContent("Your change kept: Description");
  });

  it("is refused naming who and when, and reopens the latest with the seller's price re-applied and marked", async () => {
    const words = "Bhendi Bazaar team changed this product 2 min ago. We loaded the latest and kept your changes — check and save.";
    const onSubmit = vi
      .fn<(data: ProductFormInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError(words, 409, [{ path: VERSION_FIELD, message: words }]))
      .mockResolvedValueOnce(aProduct({ version: 2 }));
    const { rerender } = renderEdit(aProduct(), onSubmit);
    fireEvent.click(card("Price & stock"));
    fireEvent.change(priceInput(), { target: { value: "1999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    // Shown before the refresh lands, so a slow or failed one never leaves the refusal silent.
    expect(screen.getByText(words)).toBeInTheDocument();

    // The refreshed page hands down the team's save: a new name, version 1.
    rerender(aProduct({ name: "Emerald Abaya (team)", version: 1, teamEditedAt: new Date(), lastEditedAt: new Date() }));
    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(priceInput().value).toBe("1999");
    expect(card("Price & stock")).toHaveTextContent("Your change kept: Price");
    expect(card("What it is")).toHaveTextContent("Emerald Abaya (team)");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0]).toMatchObject({ price: 1999, name: "Emerald Abaya (team)", seenVersion: 1 });
  });

  it("a cached older page restored after a save never lowers the version the next save claims", async () => {
    const onSubmit = vi
      .fn<(data: ProductFormInput) => Promise<unknown>>()
      .mockResolvedValueOnce(aProduct({ version: 2 }))
      .mockResolvedValueOnce(aProduct({ version: 3 }));
    const { rerender } = renderEdit(aProduct({ version: 1 }), onSubmit);
    fireEvent.click(card("Price & stock"));
    fireEvent.change(priceInput(), { target: { value: "1999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(aProduct({ version: 2, price: 199_900 }));
    // The leave guard's back step restores the pre-save page from the router cache.
    rerender(aProduct({ version: 1 }));
    fireEvent.change(priceInput(), { target: { value: "1899" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0]).toMatchObject({ seenVersion: 2 });
  });

  it("after a sale while open, says what sold and keeps the stored stock (ux Stale)", async () => {
    const onSubmit = vi
      .fn<(data: ProductFormInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("Stock changed", 409, [{ path: STOCK_FIELD, message: "Stock changed" }]));
    const { rerender } = renderEdit(aProduct(), onSubmit);
    fireEvent.click(card("Price & stock"));
    fireEvent.change(priceInput(), { target: { value: "1999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(aProduct({ stockLocations: [{ orgAddressId: "loc-1", locationName: "Shop", quantity: 8 }] }));
    expect(await screen.findByText("2 sold while you were editing. Stock is now 8.")).toBeInTheDocument();
    expect(priceInput().value).toBe("1999");
  });
});
