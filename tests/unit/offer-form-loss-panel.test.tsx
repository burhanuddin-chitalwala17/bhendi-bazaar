/**
 * The admin offer form shows the loss panel from the same rule the server refuses with
 * (offers-hardening D6, ux.md "admin offer form, loss panel"), and a shop's form never does.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { OfferForm } from "@/components/promotions/OfferForm";
import { OfferList, type OfferRow } from "@/components/promotions/OfferList";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/promotions/offersApiClient", () => ({ offersApiClient: { save: vi.fn(), stop: vi.fn() } }));

const PANEL =
  "This can cost more than we earn on a sale (lowest commission 15%). Type CONFIRM LOSS and set a budget to run it anyway.";

const renderForm = (lossRule?: { lowestRateBps: number }) =>
  render(
    <OfferForm
      action="/api/admin/promotions"
      returnTo="/admin/promotions"
      categories={[]}
      products={[]}
      productTotal={0}
      productSearchPath="/api/admin/promotions/products"
      lossRule={lossRule}
    />,
  );

const percent = () => screen.getByLabelText(/Percentage/);

describe("the admin offer form's loss panel (spec A5)", () => {
  it("shows no panel until a value is typed, and the optional budget (spec A5)", () => {
    renderForm({ lowestRateBps: 1500 });
    expect(screen.queryByText(PANEL)).toBeNull();
    expect(screen.getByLabelText(/Budget \(₹\)/)).toBeInTheDocument();
    expect(screen.getByText("Stop the offer once it has cost this much. Optional.")).toBeInTheDocument();
  });

  it("shows the panel above the lowest rate and the required budget words (spec A5)", () => {
    renderForm({ lowestRateBps: 1500 });
    fireEvent.change(percent(), { target: { value: "30" } });
    expect(screen.getByText(PANEL)).toBeInTheDocument();
    expect(screen.getByText("Set a budget for an offer that can lose money.")).toBeInTheDocument();
  });

  it("hides it at or below the lowest rate (spec A5)", () => {
    renderForm({ lowestRateBps: 1500 });
    fireEvent.change(percent(), { target: { value: "15" } });
    expect(screen.queryByText(PANEL)).toBeNull();
  });

  it("the save button stays enabled whatever the panel says (ADR-0053)", () => {
    renderForm({ lowestRateBps: 1500 });
    fireEvent.change(percent(), { target: { value: "30" } });
    expect(screen.getByRole("button", { name: "Create offer" })).toBeEnabled();
  });

  it("a shop's form has no budget and no panel (spec A5)", () => {
    renderForm();
    fireEvent.change(percent(), { target: { value: "90" } });
    expect(screen.queryByText(PANEL)).toBeNull();
    expect(screen.queryByLabelText(/Budget/)).toBeNull();
  });
});

describe("the admin offers list's budget (spec A5)", () => {
  const row = (over: Partial<OfferRow>): OfferRow => ({
    id: "p1", label: "Diwali", trigger: "AUTOMATIC", code: null, valueType: "PERCENT", percentBps: 3000,
    amountOffPaise: null, fixedPricePaise: null, startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 3_600_000), isActive: true, usageLimit: null, usageCount: 0,
    platformBudgetPaise: null, platformSpentPaise: 0, lossConfirmedAt: null, lossConfirmedBy: null, targets: [],
    ...over,
  });
  const list = (offer: OfferRow) =>
    render(<OfferList offers={[offer]} basePath="/admin/promotions" apiPath="/api/admin/promotions" />);

  it("shows spend beside usage, and the confirmed loss (spec A5)", () => {
    list(row({
      platformBudgetPaise: 5_000_000, platformSpentPaise: 1_240_000,
      lossConfirmedAt: new Date("2026-10-29T10:00:00Z"), lossConfirmedBy: { name: "Burhan" },
    }));
    expect(screen.getByText(/₹12,400 of ₹50,000 used/)).toBeInTheDocument();
    expect(screen.getByText(/Runs at a loss — confirmed by Burhan,/)).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("a spent budget reads as used up, not live (spec A5)", () => {
    list(row({ platformBudgetPaise: 100_000, platformSpentPaise: 100_000 }));
    expect(screen.getByText("Budget used up")).toBeInTheDocument();
    expect(screen.queryByText("Live")).toBeNull();
  });
});
