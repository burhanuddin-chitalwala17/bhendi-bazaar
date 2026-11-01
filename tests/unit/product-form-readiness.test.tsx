/**
 * Readiness hints while filling (product-form U2; spec R5, A3; D4, Q8): a shop selling on Amazon
 * reads what Amazon will still ask on Details and on Review, before saving; a shop selling nowhere
 * else reads nothing; and a hint never holds up the save (ADR-0053).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CHANNEL } from "@server/shared/channels";
import { FACT } from "@server/listing/listing-facts";
import { LISTING_PROBLEM, LISTING_READINESS } from "@server/listing/channel-readiness.types";
import type { ChannelVerdict } from "@server/listing/channel-readiness.service";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

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
const readiness = vi.fn();
vi.mock("@/components/product/listingApiClient", async (importActual) => ({
  ...(await importActual<typeof import("@/components/product/listingApiClient")>()),
  listingApiClient: {
    readiness: (...args: unknown[]) => readiness(...args),
    listValues: async () => ({}),
    createFamily: vi.fn(),
  },
}));

const { ProductForm } = await import("@/components/shared/forms/product");

const kurta: ProductTypeRecord = {
  key: "kurta",
  label: "Kurta",
  facts: [FACT.MATERIAL, FACT.COLOUR],
  measures: [],
  variantAxis: [],
  kinds: [],
  factLabels: { [FACT.MATERIAL]: "Fabric" },
  labelFrom: [],
  labelScale: null,
};

const amazonAsksFabric: ChannelVerdict[] = [
  {
    channel: CHANNEL.AMAZON,
    report: {
      state: LISTING_READINESS.WARNED,
      theirCategory: "KURTA",
      problems: [{ problem: LISTING_PROBLEM.MISSING_OPTIONAL_FACT, fact: FACT.MATERIAL, theirAttribute: "material" }],
    },
  },
];

const org = { id: "org-1", name: "Noor Attar House", code: "NOOR", handle: "noor" };
const stepTitle = () => screen.getByTestId("step-title").textContent;
const chip = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label.replace("&", "\\&")}`) });

function renderForm(onSubmit = vi.fn(async () => ({ id: "p-1", slug: "kurta", name: "Velvet Kurta" })), sellsElsewhere = true) {
  render(
    <ProductForm
      categories={[{ id: "cat-kurta", name: "Kurta", productType: "kurta" }]}
      productTypes={[kurta]}
      orgs={[org]}
      locations={[{ id: "loc-1", name: "Shop", city: "Mumbai", pincode: "400003", isActive: true }]}
      onSubmit={onSubmit as never}
      onCancel={vi.fn()}
      uploadEndpoints={{ presign: "/p", confirm: "/c" } as never}
      sellsElsewhere={sellsElsewhere}
    />,
  );
  return onSubmit;
}

async function pickKurta() {
  fireEvent.click(chip("What it is"));
  fireEvent.click(screen.getByRole("button", { name: /^Category/ }));
  fireEvent.click((await screen.findAllByRole("button", { name: "Kurta" }))[0]);
}

async function fillValidProduct() {
  fireEvent.click(chip("Photos and video"));
  fireEvent.click(screen.getByRole("button", { name: "stub: add a cover photo" }));
  await pickKurta();
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Velvet Kurta" } });
  fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "A soft velvet kurta." } });
  fireEvent.click(chip("Price & stock"));
  fireEvent.change(screen.getByLabelText(/^Price \(₹\)/), { target: { value: "2499" } });
  fireEvent.change(screen.getByLabelText(/^Packed weight/), { target: { value: "0.6" } });
}

beforeEach(() => {
  readiness.mockReset();
});

describe("readiness hints while filling (spec R5)", () => {
  it("a shop selling on Amazon sees 'Amazon also asks: Fabric' on Details before saving (spec A3)", async () => {
    readiness.mockResolvedValue(amazonAsksFabric);
    const onSubmit = renderForm();
    await pickKurta();
    fireEvent.click(chip("Details"));

    expect(stepTitle()).toBe("Details");
    expect(await screen.findByText("Amazon also asks: Fabric")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    // Asked with the unsaved category, for the shop the form belongs to (D4).
    expect(readiness).toHaveBeenCalledWith("/api/org/org-1", expect.objectContaining({ categoryId: "cat-kurta" }), expect.anything());
  });

  it("re-checks on leaving a step, so a typed answer clears the hint (Q8)", async () => {
    readiness.mockResolvedValue(amazonAsksFabric);
    renderForm();
    await pickKurta();
    fireEvent.click(chip("Details"));
    expect(await screen.findByText("Amazon also asks: Fabric")).toBeInTheDocument();

    readiness.mockResolvedValue([{ channel: CHANNEL.AMAZON, report: { state: LISTING_READINESS.READY, theirCategory: "KURTA", problems: [] } }]);
    fireEvent.click(chip("Review"));
    expect(await screen.findByText("Ready for Amazon")).toBeInTheDocument();
    expect(screen.queryByText(/also ask/)).toBeNull();
  });

  it("Review lists what Amazon will ask, and its button opens Details (ux Review Partial)", async () => {
    readiness.mockResolvedValue(amazonAsksFabric);
    renderForm();
    await fillValidProduct();
    fireEvent.click(chip("Review"));

    expect(await screen.findByText("Amazon will also ask: Fabric")).toBeInTheDocument();
    expect(screen.getByText("Ready for your store")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add fabric" }));
    expect(stepTitle()).toBe("Details");
  });

  it("shows 'Checking…' while Review re-checks (ux Review Loading)", async () => {
    let answer: (verdicts: ChannelVerdict[]) => void = () => {};
    readiness.mockImplementation(() => new Promise<ChannelVerdict[]>((resolve) => (answer = resolve)));
    renderForm();
    await pickKurta();
    fireEvent.click(chip("Review"));
    expect(await screen.findByText("Checking…")).toBeInTheDocument();
    answer(amazonAsksFabric);
    expect(await screen.findByText("Amazon will also ask: Fabric")).toBeInTheDocument();
    expect(screen.queryByText("Checking…")).toBeNull();
  });

  it("a shop selling nowhere else sees nothing, not even 'Checking…' (spec R5)", async () => {
    readiness.mockImplementation(() => new Promise(() => {}));
    renderForm(undefined, false);
    await pickKurta();
    fireEvent.click(chip("Details"));
    fireEvent.click(chip("Review"));
    expect(stepTitle()).toBe("Review");
    expect(screen.queryByText("Checking…")).toBeNull();
    expect(screen.queryByText(/also asks?/)).toBeNull();
    expect(screen.queryByText(/^Ready for/)).toBeNull();
    expect(readiness).not.toHaveBeenCalled();
  });

  it("asks nothing before a category with a type is chosen", async () => {
    renderForm();
    fireEvent.click(chip("Details"));
    fireEvent.click(chip("Review"));
    await Promise.resolve();
    expect(readiness).not.toHaveBeenCalled();
  });

  it("never blocks, disables or delays Put on sale, even when the check fails or hangs (spec R5, A8)", async () => {
    readiness.mockRejectedValueOnce(new Error("offline")).mockImplementation(() => new Promise(() => {}));
    const onSubmit = renderForm();
    await fillValidProduct();
    fireEvent.click(chip("Review"));
    expect(document.body.querySelectorAll("[disabled]")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Put on sale" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // Nothing of the hint reaches the save (D4).
    expect(Object.keys((onSubmit.mock.calls[0] as unknown[])[0] as object)).not.toContain("verdicts");
    expect(await screen.findByText("On sale now")).toBeInTheDocument();
  });
});
