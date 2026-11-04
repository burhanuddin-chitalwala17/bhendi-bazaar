"use client";

import { useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ActionBar } from "@/components/shared/action-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductMediaInput } from "@server/catalog/media";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import type { OrgSummary } from "@/domain/org";
import type { ProductDetails } from "@/components/product/console/types";
import { BuyerPreview } from "./BuyerPreview";
import type { LocationOption } from "./ProductOrgShippingFields";
import { ProductSections, ReviewReadiness, type ProductForm, type ProductSectionsProps, type SectionKey } from "./ProductSections";
import { useProductSections } from "./useProductSections";
import { FIELD_LABEL, FIELD_STEP, PRODUCT_STEPS, errorCountsByStep, formFieldsIn, type ProductStepKey } from "./product-steps";
import { sectionSummary, willAsk } from "./edit-overview";

/** Five cards (ux Edit overview); Review holds no fields, so a failed save never opens it. */
const CARDS = PRODUCT_STEPS as ReadonlyArray<{ key: ProductStepKey; label: string }>;
const SECTIONS = CARDS.filter((step) => step.key !== "review") as ReadonlyArray<{ key: SectionKey; label: string }>;

interface ProductEditOverviewProps {
  form: ProductForm;
  product: ProductDetails;
  categories: ProductSectionsProps["categories"];
  productTypes: ProductTypeRecord[];
  listingValues: ProductSectionsProps["listingValues"];
  origins: Partial<Record<string, string>>;
  families: Array<{ id: string; name: string }>;
  orgs?: OrgSummary[];
  locations: LocationOption[];
  onLocationAdded?: (location: LocationOption) => void;
  uploadEndpoints?: ProductSectionsProps["uploadEndpoints"];
  sellsElsewhere: boolean;
  /** The kept-draft line (D9), above the cards. */
  draft?: ReactNode;
  /** "{Who} changed this product {when}…" or "2 sold while you were editing…" (D8). */
  conflict: string | null;
  /** Fields re-applied over the latest product after a refusal, marked on their cards (R9). */
  kept: ReadonlySet<string>;
  /** The save's words; the team's reads "Save for shop" (ux.md copy deck, Admin). */
  saveLabel?: string;
}

/**
 * Editing a product (product-form R7): one card per section with a summary and its hints; a card
 * opens that section alone, and one "Save changes" saves the whole product.
 */
export function ProductEditOverview({
  form,
  product,
  categories,
  productTypes,
  listingValues,
  origins,
  families,
  orgs,
  locations,
  onLocationAdded,
  uploadEndpoints,
  sellsElsewhere,
  draft,
  conflict,
  kept,
  saveLabel = "Save changes",
}: ProductEditOverviewProps) {
  const [open, setOpen] = useState<ProductStepKey | null>(null);
  const {
    watch,
    formError,
    clearFormError,
    formState: { errors, isSubmitting },
  } = form;
  const counts = errorCountsByStep(errors);
  const { hints, readiness, categoryChange } = useProductSections(form, categories, productTypes, sellsElsewhere, open ?? "review");
  const values = watch();
  const categoryName = categories.find((category) => category.id === values.categoryId)?.name;

  // A ref, not isSubmitting: two taps inside one render would both read the old state (A8).
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      await form.onSubmit();
      setOpen(null);
    } catch {
      // A field error opens its section; a refusal is the conflict line; a failure is formError.
      const first = SECTIONS.find((section) => errorCountsByStep(form.formState.errors)[section.key] > 0);
      if (first) setOpen(first.key);
    } finally {
      saving.current = false;
    }
  };

  const preview = (
    <BuyerPreview
      name={values.name ?? ""}
      description={values.description ?? ""}
      price={Number(values.price)}
      salePrice={values.salePrice as number | undefined}
      media={(values.media ?? []) as ProductMediaInput[]}
    />
  );
  const asking = hints.filter((hint) => hint.asks.length > 0);
  const openLabel = CARDS.find((section) => section.key === open)?.label;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // React bubbles a portalled dialog's submit (the location form) up to here; it is not ours.
        if (event.target !== event.currentTarget) return;
        void save();
      }}
      className="space-y-4"
      noValidate
    >
      {draft}
      {conflict && (
        <p role="status" className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          {conflict}
        </p>
      )}

      <div className="md:grid md:grid-cols-5 md:gap-6 lg:grid-cols-12">
        <div className={cn("space-y-3 md:col-span-2 lg:col-span-4", open && "hidden md:block")}>
          <p className="text-sm text-muted-foreground">Tap a section to change it.</p>
          <ul className="space-y-2" aria-label="Sections">
            {CARDS.map((section) => {
              const count = counts[section.key];
              const hint = section.key === "details" ? asking.map(willAsk).join(" · ") : "";
              const keptHere = formFieldsIn(kept).filter((field) => FIELD_STEP[field] === (section.key as string));
              return (
                <li key={section.key}>
                  <Button
                    type="button"
                    variant="outline"
                    aria-current={open === section.key ? "true" : undefined}
                    className={cn(
                      "h-auto w-full justify-between gap-3 whitespace-normal rounded-card px-4 py-3 text-left",
                      open === section.key && "border-primary",
                    )}
                    onClick={() => setOpen(section.key)}
                  >
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-medium text-foreground">
                        {count > 0 ? `${section.label} · ${count}` : section.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {sectionSummary(section.key, values, categoryName)}
                      </span>
                      {hint && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
                          {hint}
                        </span>
                      )}
                      {keptHere.length > 0 && (
                        <span className="block text-xs text-primary">
                          Your change kept: {keptHere.map((field) => FIELD_LABEL[field]).join(", ")}
                        </span>
                      )}
                    </span>
                    <Icon name="next" tone="muted" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={cn("min-w-0 space-y-4 md:col-span-3 lg:col-span-5", !open && "hidden md:block")}>
          {open && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="md:hidden" onClick={() => setOpen(null)}>
                <Icon name="previous" />
                All sections
              </Button>
              <h2 data-testid="section-title" className="text-lg font-semibold text-foreground">
                {openLabel}
              </h2>
            </div>
          )}
          {/* Every section stays mounted, so an upload or the crop sheet survives a move (ux "Slow"). */}
          <ProductSections
            form={form}
            current={open ?? "review"}
            categories={categories}
            productTypes={productTypes}
            listingValues={listingValues}
            origins={origins}
            families={families}
            orgs={orgs}
            locations={locations}
            onLocationAdded={onLocationAdded}
            uploadEndpoints={uploadEndpoints}
            savedMedia={product.media}
            categoryChange={categoryChange}
            hints={hints}
          />
          {open === "review" && (
            <section className="space-y-4">
              <p className="text-sm text-muted-foreground">This is how buyers will see it.</p>
              <div className="lg:hidden">{preview}</div>
              <ReviewReadiness
                hints={hints}
                checking={readiness.loading}
                storeReady={Object.keys(errors).length === 0}
                onOpenDetails={() => setOpen("details")}
              />
            </section>
          )}
        </div>

        <aside className="hidden lg:col-span-3 lg:block" aria-label="Buyer preview">
          {preview}
        </aside>
      </div>

      {formError && (
        <div role="alert" className="flex flex-col gap-2 rounded-card border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{formError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearFormError();
              void save();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      <ActionBar dock="edge" className="-mx-4 md:mx-0">
        <Button type="button" size="lg" className="w-full md:w-auto" pending={isSubmitting} onClick={() => void save()}>
          {isSubmitting ? "Saving…" : saveLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
