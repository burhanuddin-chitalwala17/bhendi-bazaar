/**
 * A new product is five short steps (product-form U1): errors sit beside their field with a count
 * on the step, a save that cannot run says where, nothing in the form is disabled, and the gallery
 * editor keeps its video rules inside the first step.
 */
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PRODUCT_FORM_FIELDS } from "@/lib/validation/schemas/product.schema";
import {
  FIELD_STEP,
  MORE_OPTIONS_FIELDS,
  PRODUCT_STEPS,
  errorCountsByStep,
  firstStepWithError,
  thingsToFix,
} from "@/components/shared/forms/product/product-steps";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgId: "org-1" }),
  usePathname: () => "/org/org-1/products/new",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const direct = vi.fn();
vi.mock("@/lib/image/upload-direct", () => ({ uploadDirect: (...args: unknown[]) => direct(...args) }));

const { ProductForm } = await import("@/components/shared/forms/product");
const { ProductMediaManager } = await import("@/components/product/product-media-manager");

const endpoints = { presign: "/p", confirm: "/c" } as never;
const org = { id: "org-1", name: "Noor Attar House", code: "NOOR", handle: "noor" };

function renderCreate(onSubmit = vi.fn()) {
  render(
    <ProductForm
      categories={[{ id: "cat-1", name: "Abaya" }]}
      orgs={[org]}
      locations={[{ id: "loc-1", name: "Shop", city: "Mumbai", pincode: "400003", isActive: true }]}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      uploadEndpoints={endpoints}
    />,
  );
  return onSubmit;
}

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));
const stepHeading = () => screen.getByTestId("step-title").textContent;

describe("the step map (spec R1, R2)", () => {
  it("puts every schema field in a step, so no error can sit where the seller cannot go", () => {
    for (const field of PRODUCT_FORM_FIELDS) expect(FIELD_STEP[field], field).toBeDefined();
  });

  it("keeps the five steps in the decided order", () => {
    expect(PRODUCT_STEPS.map((step) => step.label)).toEqual([
      "Photos and video", "What it is", "Price & stock", "Details", "Review",
    ]);
  });

  it("hides only the seldom-used fields under More options (Q7)", () => {
    expect([...MORE_OPTIONS_FIELDS].sort()).toEqual(["barcode", "familyId", "flags", "lowStockThreshold", "sku", "tags"]);
  });

  it("counts nested errors on their step and finds the first one in step order (spec R4)", () => {
    const errors = {
      price: { type: "x", message: "Add the price buyers pay" },
      stockLocations: { 0: { quantity: { type: "x", message: "Stock cannot be negative" } } },
      name: { type: "x", message: "Name needs 2 or more letters" },
    } as never;
    expect(errorCountsByStep(errors)).toMatchObject({ photos: 0, what: 1, price: 2 });
    expect(firstStepWithError(errors)).toBe("what");
    // With only the price missing, the save lands on Price & stock (spec A2).
    expect(firstStepWithError({ price: { type: "x", message: "Add the price buyers pay" } } as never)).toBe("price");
    expect(thingsToFix(1)).toBe("1 thing to fix");
    expect(thingsToFix(2)).toBe("2 things to fix");
  });
});

describe("stepped create", () => {
  it("opens on Photos and video with progress, and Next moves without validating (spec R1)", () => {
    renderCreate();
    expect(stepHeading()).toBe("Photos and video");
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Start with photos. Tap 'Cover' on the one buyers see first.")).toBeInTheDocument();
    next();
    expect(stepHeading()).toBe("What it is");
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the seldom-used fields closed under More options (spec R2)", () => {
    renderCreate();
    next();
    next();
    expect(stepHeading()).toBe("Price & stock");
    expect(screen.queryByLabelText("SKU (your own code)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    expect(screen.getByLabelText("SKU (your own code)")).toBeInTheDocument();
    expect(screen.getByLabelText("Tell me when stock is below")).toBeInTheDocument();
  });

  it("Put on sale with no price lands on Price & stock with the error under Price (spec A2)", async () => {
    const onSubmit = renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /^Review/ }));
    fireEvent.click(screen.getByRole("button", { name: "Put on sale" }));

    await waitFor(() => expect(stepHeading()).toBe("Photos and video"));
    expect(onSubmit).not.toHaveBeenCalled();
    // The first step with a problem opens first (Q5); the price error waits on its own step.
    fireEvent.click(screen.getByRole("button", { name: /^Price & stock · \d/ }));
    expect(stepHeading()).toBe("Price & stock");
    const price = screen.getByLabelText(/Price \(₹\)/);
    expect(price).toHaveAttribute("aria-invalid", "true");
    const describedBy = price.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("Add the price buyers pay");
    expect(screen.getByRole("button", { name: /things? to fix · Show/ })).toBeInTheDocument();
    // No banner at the top or bottom of the form (spec R4).
    expect(screen.queryByText("Please fix the highlighted fields and try again.")).toBeNull();
  });

  it("Review lists every problem as a line that opens its step (spec R3)", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /^Review/ }));
    expect(screen.getByText("This is how buyers will see it.")).toBeInTheDocument();
    const line = await screen.findByRole("button", { name: /Add the price buyers pay/ });
    fireEvent.click(line);
    expect(stepHeading()).toBe("Price & stock");
  });

  it("disables nothing on any step (spec A8, R13)", async () => {
    renderCreate();
    for (let step = 0; step < PRODUCT_STEPS.length; step += 1) {
      expect(document.body.querySelectorAll("[disabled]"), stepHeading() ?? "").toHaveLength(0);
      if (step < PRODUCT_STEPS.length - 1) next();
    }
    fireEvent.click(screen.getByRole("button", { name: "Put on sale" }));
    await waitFor(() => expect(stepHeading()).toBe("Photos and video"));
    expect(document.body.querySelectorAll("[disabled]")).toHaveLength(0);
  });
});

describe("Photos and video keeps the gallery editor's rules (spec R14–R16)", () => {
  const item = (n: number, kind: "IMAGE" | "VIDEO" = "IMAGE") => ({
    kind, ref: `https://cdn.example.com/${n}.${kind === "VIDEO" ? "mp4" : "jpg"}`, isThumbnail: n === 0 && kind === "IMAGE", slot: null,
  });

  function renderManager(value: ReturnType<typeof item>[], savedMedia: never[] = []) {
    const onChange = vi.fn();
    render(
      <ProductMediaManager value={value} onChange={onChange} endpoints={endpoints} shotList={[]} orgCode="NOOR" savedMedia={savedMedia} />,
    );
    return onChange;
  }

  it("offers Take photo, Choose photos or video and Add YouTube link from one Add (Q32)", async () => {
    renderManager([]);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("button", { name: "Take photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose photos or video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add YouTube link" })).toBeInTheDocument();
  });

  it("refuses an eleventh item by saying so, and Add stays tappable (spec A10, Q36)", () => {
    renderManager(Array.from({ length: 10 }, (_, n) => item(n)));
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).not.toBeDisabled();
    fireEvent.click(add);
    expect(screen.getByRole("alert")).toHaveTextContent("A product can have at most 10 gallery items");
    expect(screen.queryByRole("button", { name: "Take photo" })).toBeNull();
  });

  it("disables nothing at the cap: every add path says why instead (spec A8, R13)", () => {
    renderManager(Array.from({ length: 10 }, (_, n) => item(n)));
    expect(document.body.querySelectorAll("[disabled]")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Add video/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("A product can have at most 10 gallery items");
  });

  it("disables nothing while a video uploads (spec A8)", async () => {
    let finish: (value: unknown) => void = () => {};
    direct.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderManager([item(0)]);
    const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "clip.mp4", { type: "video/mp4" })] } });
    expect(await screen.findByText("Uploading…")).toBeInTheDocument();
    expect(document.body.querySelectorAll("[disabled]")).toHaveLength(0);
    finish({ url: "https://cdn.example.com/clip.mp4", assetId: "a-1", reused: false });
  });

  it("never loses an item or passes 10 when two picks overlap (spec R14, Q36)", async () => {
    // A stateful parent, as the form is: each commit re-renders with the new gallery.
    function Harness({ start }: { start: ReturnType<typeof item>[] }) {
      const [media, setMedia] = useState(start);
      return (
        <>
          <ProductMediaManager value={media} onChange={setMedia as never} endpoints={endpoints} shotList={[]} orgCode="NOOR" />
          <output data-testid="refs">{media.map((row) => row.ref).join(" ")}</output>
        </>
      );
    }
    const resolvers: Array<(value: unknown) => void> = [];
    direct.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
    render(<Harness start={Array.from({ length: 8 }, (_, n) => item(n))} />);
    const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    const clip = (name: string) => new File(["x"], name, { type: "video/mp4" });

    fireEvent.change(input, { target: { files: [clip("a.mp4")] } });
    expect(await screen.findByText("1 video still uploading")).toBeInTheDocument();
    // A second Add mid-upload waits, by saying so, rather than racing the first.
    fireEvent.click(screen.getByRole("button", { name: /Uploading/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Wait for the upload to finish");
    // A pick that still reaches the input (a slot's own picker) must not overwrite the first.
    fireEvent.change(input, { target: { files: [clip("b.mp4"), clip("c.mp4")] } });

    // Land every upload, one at a time, waiting for each to be committed before the next.
    const land = async (name: string) => {
      await waitFor(() => expect(resolvers.length).toBeGreaterThan(0));
      resolvers.shift()?.({ url: `https://cdn.example.com/${name}`, assetId: name, reused: false });
    };
    await land("a.mp4");
    await waitFor(() => expect(screen.getByTestId("refs").textContent).toContain("a.mp4"));
    // The second batch commits once both its files land; only b still fits beside the 8 and a.
    await land("b.mp4");
    await land("c.mp4");
    await waitFor(() => expect(screen.getByTestId("refs").textContent).toContain("b.mp4"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("A product can have at most 10 gallery items"));

    const refs = screen.getByTestId("refs").textContent?.split(" ") ?? [];
    expect(refs).toContain("https://cdn.example.com/a.mp4");
    expect(refs).toContain("https://cdn.example.com/b.mp4");
    expect(refs).toHaveLength(10);
    for (let n = 0; n < 8; n += 1) expect(refs).toContain(item(n).ref);
    direct.mockReset();
  });

  it("gives a video row no Cover button (spec A10, R15)", () => {
    renderManager([item(0), item(1, "VIDEO")]);
    const rows = screen.getAllByRole("listitem");
    const videoRow = rows.find((row) => within(row).queryByText("Video"));
    expect(videoRow).toBeDefined();
    expect(within(videoRow as HTMLElement).queryByRole("button", { name: /Cover/ })).toBeNull();
  });

  it("marks a fresh video Processing with the code's copy (spec A9, R16)", () => {
    renderManager([item(0), item(1, "VIDEO")]);
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(
      screen.getByText("Being made playable in the background. Save whenever you like; it plays on the product page once ready."),
    ).toBeInTheDocument();
  });

  it("refuses a 250 MB video before a byte moves (spec A9)", async () => {
    renderManager([item(0)]);
    const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    const clip = new File(["x"], "clip.mov", { type: "video/quicktime" });
    Object.defineProperty(clip, "size", { value: 250 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [clip] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not upload clip.mov (Too large: clip.mov. A video is at most 200 MB).",
    );
    expect(direct).not.toHaveBeenCalled();
  });

  it("lets Next leave the step while a video is processing (spec A9)", async () => {
    direct.mockResolvedValueOnce({ url: "https://cdn.example.com/clip.mp4", assetId: "a-1", reused: false });
    renderCreate();
    const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "clip.mp4", { type: "video/mp4" })] } });
    expect(await screen.findByText("Processing")).toBeInTheDocument();
    next();
    expect(stepHeading()).toBe("What it is");
  });
});
