/**
 * Changing the category names what will not carry over (product-form U3; spec R6, A4; D5, Q9): the
 * sheet lists the answers the new type does not ask, "Keep {old}" changes nothing, and answers stay
 * in the form until save, so switching back restores them while the save sends only what is asked.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FACT, MEASURE } from "@server/listing/listing-facts";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import { CATEGORY_SHEET, answersLost, keepAsked } from "@/components/shared/forms/product/category-change";

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
vi.mock("@/components/product/listingApiClient", () => ({
  listingApiClient: { readiness: async () => [], listValues: async () => ({}), createFamily: vi.fn() },
}));

const { ProductForm } = await import("@/components/shared/forms/product");

const abaya: ProductTypeRecord = {
  key: "islamic-wear",
  label: "Islamic wear",
  facts: [FACT.COLOUR, FACT.MATERIAL, FACT.SLEEVE_LENGTH],
  measures: [{ key: MEASURE.LENGTH, label: "Length", unit: "in", required: true }],
  variantAxis: [],
  kinds: [{ key: "rida", label: "Rida" }],
  factLabels: { [FACT.MATERIAL]: "Fabric" },
  labelFrom: [],
  labelScale: null,
};
const ring: ProductTypeRecord = {
  key: "jewellery",
  label: "Jewellery",
  facts: [FACT.COLOUR, FACT.PLATING],
  measures: [{ key: MEASURE.DIAMETER, label: "Inner diameter", unit: "mm", required: true }],
  variantAxis: [],
  kinds: [{ key: "ring", label: "Ring" }],
  factLabels: {},
  labelFrom: [],
  labelScale: null,
};
const option = (key: string) => ({ key, label: key[0].toUpperCase() + key.slice(1), orgId: null });
const listingValues = {
  colour: [option("black")],
  material: [option("crepe")],
  sleeveLength: [option("full")],
  plating: [option("gold")],
};

const org = { id: "org-1", name: "Noor Attar House", code: "NOOR", handle: "noor" };
const stepTitle = () => screen.getByTestId("step-title").textContent;
const chip = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label.replace("&", "\\&")}`) });

function renderForm(onSubmit = vi.fn(async () => ({ id: "p-1", slug: "abaya", name: "Crepe Abaya" }))) {
  render(
    <ProductForm
      categories={[
        { id: "cat-abaya", name: "Abaya", productType: "islamic-wear" },
        { id: "cat-ring", name: "Ring", productType: "jewellery" },
        { id: "cat-gift", name: "Gift card" },
      ]}
      productTypes={[abaya, ring]}
      listingValues={listingValues}
      orgs={[org]}
      locations={[{ id: "loc-1", name: "Shop", city: "Mumbai", pincode: "400003", isActive: true }]}
      onSubmit={onSubmit as never}
      onCancel={vi.fn()}
      uploadEndpoints={{ presign: "/p", confirm: "/c" } as never}
    />,
  );
  return onSubmit;
}

async function pick(name: string) {
  fireEvent.click(chip("What it is"));
  fireEvent.click(screen.getByRole("button", { name: /^Category/ }));
  fireEvent.click((await screen.findAllByRole("button", { name: name }))[0]);
}

async function fillAbayaDetails() {
  await pick("Abaya");
  fireEvent.click(chip("Details"));
  fireEvent.change(screen.getByLabelText("Colour"), { target: { value: "black" } });
  fireEvent.change(screen.getByLabelText("Fabric"), { target: { value: "crepe" } });
  fireEvent.change(screen.getByLabelText("Sleeve length"), { target: { value: "full" } });
  fireEvent.change(screen.getByLabelText("Length (in)"), { target: { value: "54" } });
}

const sheetTitle = () => screen.queryByText("Change to Ring?");

describe("what a category change loses (D5)", () => {
  it("lists answered facts and measurements the new type does not ask, in the old type's words (spec A4)", () => {
    const values = { facts: { colour: "black", material: "crepe", sleeveLength: "full" }, measurements: { length: 54 }, kind: null };
    expect(answersLost(values, abaya, ring)).toEqual(["Fabric", "Sleeve length", "Length"]);
    // A blank answer is nothing to lose; a shared fact carries over.
    expect(answersLost({ facts: { colour: "black", material: "" } }, abaya, ring)).toEqual([]);
    expect(answersLost(values, abaya, abaya)).toEqual([]);
    expect(answersLost(values, null, ring)).toEqual([]);
  });

  it("names a kind the new type cannot hold, even for a category with no type", () => {
    expect(answersLost({ kind: "rida" }, abaya, ring)).toEqual(["Kind"]);
    expect(answersLost({ kind: "rida", facts: { material: "crepe" } }, abaya, null)).toEqual(["Kind"]);
  });

  it("the save keeps only what the chosen type asks", () => {
    const values = { facts: { colour: "black", material: "crepe" }, measurements: { length: 54, diameter: 17 }, kind: "rida" };
    expect(keepAsked(values, ring)).toEqual({ facts: { colour: "black" }, measurements: { diameter: 17 }, kind: null });
    expect(keepAsked(values, abaya)).toEqual({ facts: { colour: "black", material: "crepe" }, measurements: { length: 54 }, kind: "rida" });
  });

  it("words the sheet exactly as ux.md's copy deck", () => {
    expect(CATEGORY_SHEET.title("Ring")).toBe("Change to Ring?");
    expect(CATEGORY_SHEET.body(["Fabric", "Length", "Sleeve"], "Ring")).toBe("Fabric, Length, Sleeve won't apply to a ring.");
    expect(CATEGORY_SHEET.body(["Fabric"], "Abaya")).toBe("Fabric won't apply to an abaya.");
    expect(CATEGORY_SHEET.keep("Abaya")).toBe("Keep Abaya");
    expect(CATEGORY_SHEET.change("Ring")).toBe("Change to Ring");
  });
});

describe("the category-change sheet (spec R6)", () => {
  it("switching Abaya to Ring lists the three answers that won't carry over (spec A4)", async () => {
    renderForm();
    await fillAbayaDetails();
    await pick("Ring");
    expect(await screen.findByText("Change to Ring?")).toBeInTheDocument();
    expect(screen.getByText("Fabric, Sleeve length, Length won't apply to a ring.")).toBeInTheDocument();
    expect(document.body.querySelectorAll("[disabled]")).toHaveLength(0);
  });

  it("'Keep Abaya' changes nothing (spec A4)", async () => {
    renderForm();
    await fillAbayaDetails();
    await pick("Ring");
    fireEvent.click(await screen.findByRole("button", { name: "Keep Abaya" }));
    await waitFor(() => expect(sheetTitle()).toBeNull());
    expect(screen.getByRole("button", { name: /^Category/ })).toHaveTextContent("Abaya");
    fireEvent.click(chip("Details"));
    expect(screen.getByLabelText("Fabric")).toHaveValue("crepe");
    expect(screen.getByLabelText("Length (in)")).toHaveValue(54);
  });

  it("switching back after confirming restores the answers (spec A4)", async () => {
    renderForm();
    await fillAbayaDetails();
    await pick("Ring");
    fireEvent.click(await screen.findByRole("button", { name: "Change to Ring" }));
    await waitFor(() => expect(sheetTitle()).toBeNull());
    fireEvent.click(chip("Details"));
    expect(screen.queryByLabelText("Fabric")).toBeNull();
    expect(screen.getByLabelText("Colour")).toHaveValue("black");

    // Ring has nothing Abaya would lose, so the way back asks nothing.
    await pick("Abaya");
    expect(screen.queryByText("Change to Abaya?")).toBeNull();
    fireEvent.click(chip("Details"));
    expect(screen.getByLabelText("Fabric")).toHaveValue("crepe");
    expect(screen.getByLabelText("Sleeve length")).toHaveValue("full");
    expect(screen.getByLabelText("Length (in)")).toHaveValue(54);
  });

  it("a kind kept from Abaya shows again when switched back", async () => {
    renderForm();
    await pick("Abaya");
    fireEvent.click(chip("Details"));
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "rida" } });
    await pick("Ring");
    expect(await screen.findByText("Kind won't apply to a ring.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change to Ring" }));
    await waitFor(() => expect(sheetTitle()).toBeNull());
    await pick("Abaya");
    fireEvent.click(chip("Details"));
    expect(screen.getByLabelText("Kind")).toHaveValue("rida");
  });

  it("asks nothing when no answer would be lost", async () => {
    renderForm();
    await pick("Abaya");
    await pick("Ring");
    expect(sheetTitle()).toBeNull();
    expect(screen.getByRole("button", { name: /^Category/ })).toHaveTextContent("Ring");
  });

  it("saves only the answers the chosen category asks (Q9)", async () => {
    const onSubmit = renderForm();
    await fillAbayaDetails();
    await pick("Ring");
    fireEvent.click(await screen.findByRole("button", { name: "Change to Ring" }));
    fireEvent.click(chip("Details"));
    fireEvent.change(screen.getByLabelText("Inner diameter (mm)"), { target: { value: "17" } });
    fireEvent.click(chip("Photos and video"));
    fireEvent.click(screen.getByRole("button", { name: "stub: add a cover photo" }));
    fireEvent.click(chip("What it is"));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Silver Ring" } });
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "A plain silver ring." } });
    fireEvent.click(chip("Price & stock"));
    fireEvent.change(screen.getByLabelText(/^Price \(₹\)/), { target: { value: "999" } });
    fireEvent.change(screen.getByLabelText(/^Packed weight/), { target: { value: "0.1" } });
    fireEvent.click(chip("Review"));
    expect(stepTitle()).toBe("Review");
    fireEvent.click(screen.getByRole("button", { name: "Put on sale" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const sent = (onSubmit.mock.calls[0] as unknown[])[0] as { categoryId: string; facts: object; measurements: object };
    expect(sent.categoryId).toBe("cat-ring");
    expect(sent.facts).toMatchObject({ colour: "black" });
    expect(Object.keys(sent.facts).sort()).toEqual(["colour", "plating"]);
    // Abaya's Fabric, Sleeve length and Length stayed in the form but are not sent.
    expect(sent.measurements).toEqual({ diameter: 17 });
  });
});
