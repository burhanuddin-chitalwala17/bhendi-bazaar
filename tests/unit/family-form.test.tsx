/**
 * The family page's form and the hand picker send what the owner chose (family-merge ux.md):
 * answers, left-out members and moves; the server plans everything else.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FamilyForm } from "@/components/channel/family-form";
import { GroupPicker } from "@/components/channel/group-picker";
import type { FamilyPageDTO } from "@server/channels/channel-family.types";
import type { ChannelListingDTO } from "@server/channels/channel-connection.types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
const settleFamily = vi.fn();
vi.mock("@/components/channel/channelsApiClient", () => ({
  channelsApiClient: { settleFamily: (...args: unknown[]) => settleFamily(...args) },
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

const member = (id: string, over: Partial<FamilyPageDTO["members"][number]> = {}): FamilyPageDTO["members"][number] => ({
  listingId: id,
  sku: `SKU-${id}`,
  externalId: null,
  title: `Floral trousers ${id}`,
  imageUrl: null,
  status: "LIVE",
  live: true,
  pricePaise: 99_900,
  quantity: 3,
  readFailed: false,
  product: null,
  ...over,
});

const detail = (over: Partial<FamilyPageDTO> = {}): FamilyPageDTO => ({
  channel: "amazon",
  label: "Amazon",
  family: null,
  name: "Floral trousers",
  description: "Shared",
  members: [
    member("a"),
    member("b"),
    member("c", { product: { id: "p1", name: "Own red", sku: "OWN-RED", pricePaise: 120_000, archived: false, family: { id: "f2", name: "Old family" } } }),
  ],
  more: 0,
  type: null,
  defaultCategoryId: "cat-trousers",
  typeOfCategory: { "cat-trousers": "trousers" },
  byType: {
    trousers: {
      label: "Trousers",
      axes: [{ key: "colour", label: "Colour", added: false }, { key: "length", label: "Length", added: true }],
      members: [
        { listingId: "a", values: { colour: { value: "black", display: "Black", from: "listing" }, length: { value: 17, display: "17 in", from: "listing" } }, questions: [] },
        { listingId: "b", values: { length: { value: 18, display: "18 in", from: "listing" } }, questions: [{ fact: "colour", label: "Colour", said: "Ink", options: [{ key: "navy", label: "Navy" }, { key: "black", label: "Black" }] }] },
        { listingId: "c", values: { colour: { value: "red", display: "Red", from: "existing" } }, questions: [] },
      ],
      shared: [{ fact: "material", label: "Fabric", value: "Cotton" }],
      sharedQuestions: [],
      duplicates: [],
    },
  },
  locations: [{ id: "loc-1", name: "Mumbai shop" }],
  ...over,
});

const renderForm = (d: FamilyPageDTO = detail()) =>
  render(<FamilyForm orgId="org_1" detail={d} categories={[{ id: "cat-trousers", name: "Trousers" }]} backHref="/org/org_1/channels/amazon/listings?tab=notLinked" />);

describe("the family page's form (family-merge ux.md)", () => {
  it("says what the family varies by, and sends answers, a move and the removed axis (spec A1, Q11, Q16, Q18)", async () => {
    settleFamily.mockReset().mockResolvedValue({ result: { familyId: "f1", familyName: "Floral trousers", members: 3, axisWord: "colours" } });
    renderForm();
    expect(screen.getByText("This family varies by Colour and Length (the listings differ on both).")).toBeInTheDocument();
    expect(screen.getByText("Amazon says Colour: Ink. Which fits?")).toBeInTheDocument();
    expect(screen.getByText("In family Old family. Move it here?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Navy" }));
    fireEvent.click(screen.getByRole("button", { name: "Move here" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Length" }));
    fireEvent.submit(screen.getByRole("button", { name: "Make family of 3" }).closest("form")!);
    await waitFor(() => expect(settleFamily).toHaveBeenCalledTimes(1));
    const body = settleFamily.mock.calls[0][1];
    expect(body.answers).toEqual({ b: { colour: "navy" } });
    expect(body.removedAxes).toEqual(["length"]);
    expect(body.members.find((m: { listingId: string }) => m.listingId === "c")).toMatchObject({ move: true });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/org/org_1/channels/amazon/listings?tab=linked"));
  });

  it("leaves a member out and counts only those included", () => {
    renderForm();
    fireEvent.click(screen.getAllByRole("button", { name: "Include" })[0]);
    expect(screen.getByRole("button", { name: "Make family of 2" })).toBeInTheDocument();
  });

  it("says when the chosen category has no product type (Q17), and when the group is too large (Q19)", () => {
    renderForm(detail({ defaultCategoryId: "cat-none", more: 12 }));
    expect(screen.getByText("This group has 15 listings. The first 3 make the family now; add the rest after with Add to family.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Category/), { target: { value: "" } });
    expect(screen.getByText("Pick a category to see what the members share and how they differ.")).toBeInTheDocument();
  });
});

describe("picking listings by hand (family-merge ux.md, Q5)", () => {
  const listing = (id: string): ChannelListingDTO =>
    ({ id, sku: `S-${id}`, title: `Hijab ${id}`, imageUrl: null, product: null, leftOff: false, gone: false }) as ChannelListingDTO;

  it("continues to the family page with the picked listings, and says why when fewer than two", () => {
    toastError.mockReset();
    render(<GroupPicker orgId="org_1" listings={[listing("1"), listing("2"), listing("3")]} cancelHref="/back" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(toastError).toHaveBeenCalledWith("Pick at least two listings that are one item.");
    fireEvent.click(screen.getByLabelText(/Hijab 1/));
    fireEvent.click(screen.getByLabelText(/Hijab 3/));
    expect(screen.getByText("2 picked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/org/org_1/channels/family?listings=1,3");
  });
});
