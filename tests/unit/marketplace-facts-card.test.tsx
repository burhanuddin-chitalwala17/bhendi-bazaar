/**
 * The "Facts from {marketplace}" card reads as ux.md writes it and sends the command its tap names
 * (marketplace-facts D8). The card is computed on the server; here it is handed each state.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MarketplaceFactsCard } from "@/components/channel/marketplace-facts-card";
import type { ProductMarketplaceFactsDTO } from "@server/channels/channel-facts.types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const change = vi.fn();
vi.mock("@/components/channel/channelsApiClient", () => ({
  channelsApiClient: { changeMarketplaceFacts: (...args: unknown[]) => change(...args) },
}));

const card = (over: Partial<ProductMarketplaceFactsDTO> = {}): ProductMarketplaceFactsDTO => ({
  listingId: "l-1",
  channel: "amazon",
  label: "Amazon",
  sku: "MAT-1",
  title: "Green prayer mat",
  state: "ready",
  readAt: new Date().toISOString(),
  marketplaceType: "RUG",
  filled: [],
  questions: [],
  skipped: [],
  staleCheckedOn: null,
  types: [],
  ...over,
});

const show = (c: ProductMarketplaceFactsDTO) =>
  render(<MarketplaceFactsCard orgId="org_1" productId="p1" shopName="Niqab Boutique" card={c} />);

describe("the Facts from Amazon card (marketplace-facts ux.md)", () => {
  it("asks an unclear fact with our answers, and a tap answers it (spec A2)", async () => {
    change.mockReset().mockResolvedValue({ ok: true });
    show(
      card({
        filled: [{ fact: "colour", column: "facts", label: "Colour", value: "Green", said: "Light Green", chosen: false, changed: false, options: [] }],
        questions: [{ fact: "material", label: "Fabric", said: "Other", options: [{ key: "crepe", label: "Crepe" }, { key: "cotton", label: "Cotton" }] }],
      }),
    );
    expect(screen.getByText("1 fact filled from Amazon · 1 to confirm")).toBeInTheDocument();
    expect(screen.getByText("Amazon says Fabric: Other. Which fits this product?")).toBeInTheDocument();
    expect(screen.getByText("from Amazon")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crepe" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith("org_1", "amazon", "l-1", { action: "answer", fact: "material", value: "crepe" }));
  });

  it("marks a fact the shop changed, and offers Amazon's answer back (spec A7)", async () => {
    change.mockReset().mockResolvedValue({ ok: true });
    show(card({ filled: [{ fact: "material", column: "facts", label: "Fabric", value: "Cotton", said: "Crepe", chosen: false, changed: true, options: [] }] }));
    expect(screen.getByText("changed by you (was Crepe from Amazon)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset to Amazon's answer" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith("org_1", "amazon", "l-1", { action: "reset", fact: "material" }));
  });

  it("says a product with no type has nothing to fill, and where to fix it (spec A3)", () => {
    show(card({ state: "no_type" }));
    expect(screen.getByText("This product has no product type, so there are no Amazon facts to fill. Set its category first.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit product" })).toHaveAttribute("href", "/org/org_1/products/p1/edit");
  });

  it("says a marketplace that shares nothing has nothing to fill, with no error (spec A5)", () => {
    show(card({ channel: "flipkart", label: "Flipkart", state: "no_answers" }));
    expect(screen.getByText("Flipkart didn't share any answers for this listing, so there's nothing to fill.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fill from Flipkart" })).toBeInTheDocument();
  });

  it("says when Amazon is busy after a Fill, with Try again (ux.md Retryable error)", async () => {
    change.mockReset().mockResolvedValue({ ok: true, outcome: "busy" });
    show(card({ state: "not_read" }));
    fireEvent.click(screen.getByRole("button", { name: "Fill from Amazon" }));
    expect(await screen.findByText("Couldn't read Amazon's answers. Amazon is busy; try again in a few minutes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("asks which category a mapped type goes in, then sends it (Q25)", async () => {
    change.mockReset().mockResolvedValue({ ok: true });
    show(card({ state: "category_to_confirm", types: [{ key: "prayer-mat", label: "Prayer mat", categories: [{ id: "c1", name: "Prayer mats" }] }] }));
    expect(screen.getByText("Amazon lists this as RUG, our Prayer mat. Which category does it go in?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prayer mats" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith("org_1", "amazon", "l-1", { action: "category", categoryId: "c1" }));
  });

  it("puts the 90-day note above a stale mapping (Q8)", () => {
    const fourMonths = new Date(Date.now() - 120 * 24 * 60 * 60_000).toISOString();
    show(card({ staleCheckedOn: fourMonths }));
    expect(screen.getByText("Check the mapping: Amazon's answers for this type were last checked 4 months ago.")).toBeInTheDocument();
  });

  it("lists a skipped question to ask again, and says when nothing new was filled (D6)", async () => {
    change.mockReset().mockResolvedValue({ ok: true });
    show(card({ skipped: [{ fact: "material", label: "Fabric" }] }));
    expect(screen.getByText("Nothing new to fill from Amazon: the facts it answers are already filled.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask Fabric again" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith("org_1", "amazon", "l-1", { action: "skip", fact: "material", skipped: false }));
  });
});
