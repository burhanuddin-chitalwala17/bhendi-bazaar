"use client";

import type { BrandDto } from "@server/catalog/brand.types";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ActionBar } from "@/components/shared/action-bar";
import type { FieldErrors } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { ProductMediaManager } from "@/components/product/product-media-manager";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";
import type { ProductMediaInput } from "@server/catalog/media";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import type { OrgSummary } from "@/domain/org";
import type { ProductDetails, ProductFormInput } from "@/components/product/console/types";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import type { useServerForm } from "@/hooks/core/useServerForm";
import { keepAsked } from "./category-change";
import { BuyerPreview } from "./BuyerPreview";
import type { LocationOption } from "./ProductOrgShippingFields";
import type { useProductSteps } from "./useProductSteps";
import { ProductSections, ReviewReadiness } from "./ProductSections";
import { useProductSections } from "./useProductSections";
import {
  FIELD_STEP,
  MORE_OPTIONS_FIELDS,
  PRODUCT_STEPS,
  errorCountsByStep,
  listProblems,
  thingsToFix,
  type ProductProblem,
  type ProductStepKey,
} from "./product-steps";
import { PRODUCT_STEPS_FORM_COPY } from "./product-copy";
import { ROUTES } from "@server/shared/routes";

type Form = ReturnType<typeof useServerForm<ProductFormInput>>;
type Steps = ReturnType<typeof useProductSteps>;

interface ProductStepsFormProps {
  form: Form;
  steps: Steps;
  categories: { id: string; name: string; parentId?: string | null; shotList?: unknown; productType?: unknown }[];
  productTypes: ProductTypeRecord[];
  listingValues: Record<string, Array<{ key: string; label: string; orgId: string | null }>>;
  origins: Partial<Record<string, string>>;
  families: Array<{ id: string; name: string }>;
  /** The shop's brands, for the Brand picker; what Amazon's brand complaints point at (marketplace-publish Q24). */
  brands?: BrandDto[];
  /** The shop's own country of origin, for a product whose brand names none (A4). */
  shopCountry?: string | null;
  orgs?: OrgSummary[];
  locations: LocationOption[];
  /** Absent for the team: adding a shop's address is the shop's own screen. */
  onLocationAdded?: (location: LocationOption) => void;
  uploadEndpoints?: Parameters<typeof ProductMediaManager>[0]["endpoints"];
  /** "Start from a product you already sell", rendered at the top of Photos and video (Q15). */
  copyFrom?: ReactNode;
  /** False for a shop selling nowhere else: no hint is asked for and none shows (R5). */
  sellsElsewhere: boolean;
  /** The product just put on sale; set, the success screen replaces the steps (Q16). */
  created: ProductDetails | null;
  onStartAnother: () => void;
  /** The kept-draft line (D9), or the team's banner, above the steps. */
  draft?: ReactNode;
  /** The save's words; the team's reads "Put on sale for shop" (ux.md copy deck, Admin). */
  saveLabel?: string;
}

const isMoreOptionsField = (path: string) => (MORE_OPTIONS_FIELDS as readonly string[]).includes(path.split(".")[0]);

const STEP_INTRO: Partial<Record<ProductStepKey, string>> = {
  photos: PRODUCT_STEPS_FORM_COPY.introPhotos,
  review: PRODUCT_STEPS_FORM_COPY.introReview,
};

/** Problems from the unsaved values and from the last save, one line each (Review, R3). */
function useProblems(
  form: Form,
  errors: FieldErrors<ProductFormInput>,
  active: boolean,
  productType: ProductTypeRecord | null,
): ProductProblem[] {
  // Parsed only while Review shows: a full parse per keystroke is felt on a low-end phone.
  // Parsed as the save parses it: an answer the chosen type does not ask is no problem (D5).
  const values = active ? keepAsked(form.getValues(), productType) : null;
  return useMemo(() => {
    if (!values) return [];
    const parsed = productFormSchema.safeParse(values);
    const fromValues: ProductProblem[] = parsed.success
      ? []
      : parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          step: FIELD_STEP[String(issue.path[0]) as keyof typeof FIELD_STEP] ?? "review",
        }));
    // A server refusal (a SKU already used) is not in the schema; it arrives as a field error.
    const seen = new Set(fromValues.map((problem) => `${problem.path}|${problem.message}`));
    const fromSave = listProblems(errors).filter((problem) => !seen.has(`${problem.path}|${problem.message}`));
    const order = PRODUCT_STEPS.map((step) => step.key);
    return [...fromValues, ...fromSave].sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- values is a fresh object each render
  }, [JSON.stringify(values), errors]);
}

/**
 * A new product in five short steps (product-form R1–R4, D1–D3). One form, one schema, one save:
 * the steps only choose which fields are on screen. "Next" never validates; PRODUCT_STEPS_FORM_COPY.save submits.
 */
export function ProductStepsForm({
  form,
  steps,
  categories,
  productTypes,
  listingValues,
  origins,
  families,
  brands,
  shopCountry = null,
  orgs,
  locations,
  onLocationAdded,
  uploadEndpoints,
  copyFrom,
  sellsElsewhere,
  created,
  onStartAnother,
  draft,
  saveLabel = PRODUCT_STEPS_FORM_COPY.save,
}: ProductStepsFormProps) {
  const {
    watch,
    formError,
    clearFormError,
    formState: { errors, isSubmitting },
  } = form;
  const counts = errorCountsByStep(errors);
  const errorTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);
  // Readiness hints (D4) and the category-change sheet (D5), shared with the edit overview.
  const { productType, readiness, hints, categoryChange } = useProductSections(
    form,
    categories,
    productTypes,
    sellsElsewhere,
    steps.current,
  );
  const problems = useProblems(form, errors, steps.isReview, productType);

  // A ref, not isSubmitting: two taps inside one render would both read the old state.
  const saving = useRef(false);
  const putOnSale = async () => {
    // Never disabled (A8): a second tap while saving is ignored instead.
    if (saving.current) return;
    saving.current = true;
    try {
      await form.onSubmit();
    } catch {
      // Handled below: the errors are not in this render's formState yet.
    } finally {
      saving.current = false;
    }
  };

  // After each save attempt, open the step holding the first problem (Q5) — client rules and a
  // server refusal on a field (a SKU already used) alike. Keyed on the attempt, so typing a fix
  // on one step never pulls the shop to another.
  const { submitCount } = form.formState;
  const handled = useRef(0);
  const { showFirstError } = steps;
  useEffect(() => {
    if (submitCount === handled.current || isSubmitting) return;
    if (Object.keys(errors).length === 0) return;
    handled.current = submitCount;
    showFirstError(errors);
  }, [submitCount, isSubmitting, errors, showFirstError]);

  if (created) return <SuccessScreen product={created} onStartAnother={onStartAnother} />;

  const current = steps.current;
  const stepLabel = PRODUCT_STEPS[steps.index].label;
  const preview = (
    <BuyerPreview
      name={watch("name") ?? ""}
      description={watch("description") ?? ""}
      price={Number(watch("price"))}
      salePrice={watch("salePrice") as number | undefined}
      media={(watch("media") ?? []) as ProductMediaInput[]}
    />
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // React bubbles a portalled dialog's submit (the location form) up to here; it is not ours.
        if (event.target !== event.currentTarget) return;
        if (steps.isReview) void putOnSale();
        else steps.next();
      }}
      className="space-y-4"
      noValidate
    >
      {draft}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Step {steps.index + 1} of {PRODUCT_STEPS.length}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((steps.index + 1) / PRODUCT_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="md:grid md:grid-cols-4 md:gap-6 lg:grid-cols-12">
        {/* Chips on a phone, a left rail from md (Q19). */}
        <nav aria-label={PRODUCT_STEPS_FORM_COPY.steps} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:col-span-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 lg:col-span-3">
          {PRODUCT_STEPS.map((step) => {
            const count = counts[step.key];
            const done = steps.visited.has(step.key) && count === 0 && step.key !== "review";
            return (
              <Button
                key={step.key}
                type="button"
                size="sm"
                variant={step.key === current ? "default" : "outline"}
                aria-current={step.key === current ? "step" : undefined}
                className="shrink-0 rounded-full md:justify-start md:rounded-field"
                onClick={() => steps.goTo(step.key)}
              >
                {count > 0 ? `${step.label} · ${count}` : step.label}
                {done && <Icon name="done" />}
              </Button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4 md:col-span-3 lg:col-span-6">
          <div>
            <h2 data-testid="step-title" className="text-lg font-semibold text-foreground">
              {stepLabel}
            </h2>
            {STEP_INTRO[current] && <p className="text-sm text-muted-foreground">{STEP_INTRO[current]}</p>}
          </div>

          {/* Every step stays mounted, so an upload or the crop sheet survives "Next" (ux "Slow"). */}
          <ProductSections
            form={form}
            current={current}
            categories={categories}
            productTypes={productTypes}
            listingValues={listingValues}
            origins={origins}
            families={families}
            brands={brands}
          shopCountry={shopCountry}
            orgs={orgs}
            locations={locations}
            onLocationAdded={onLocationAdded}
            uploadEndpoints={uploadEndpoints}
            copyFrom={copyFrom}
            categoryChange={categoryChange}
            hints={hints}
          />

          <section hidden={current !== "review"} className="space-y-4">
              <div className="lg:hidden">{preview}</div>
              <ReviewReadiness
                hints={hints}
                checking={readiness.loading}
                storeReady={problems.length === 0}
                onOpenDetails={() => steps.goTo("details")}
              />
              {problems.length > 0 && (
                <ul className="space-y-2" aria-label={PRODUCT_STEPS_FORM_COPY.stillToFix}>
                  {problems.map((problem) => (
                    <li key={`${problem.path}-${problem.message}`}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                        onClick={() => steps.goTo(problem.step)}
                      >
                        <span className="text-muted-foreground">{PRODUCT_STEPS.find((s) => s.key === problem.step)?.label}:</span>{" "}
                        <span className="text-destructive">{problem.message}</span>
                        {isMoreOptionsField(problem.path) && <span className="text-muted-foreground"> · Open More options</span>}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          {formError && (
            <div role="alert" className="flex flex-col gap-2 rounded-card border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>{formError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  clearFormError();
                  void putOnSale();
                }}
              >
                {PRODUCT_STEPS_FORM_COPY.tryAgain}
              </Button>
            </div>
          )}
        </div>

        <aside className="hidden lg:col-span-3 lg:block" aria-label={PRODUCT_STEPS_FORM_COPY.buyerPreview}>
          {preview}
        </aside>
      </div>

      {/* The org portal has no tab bar, so the bar sits on the screen's own edge. */}
      <ActionBar
        dock="edge"
        className="-mx-4 md:mx-0"
        status={
          errorTotal > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-between text-destructive"
              onClick={() => steps.showFirstError(errors)}
            >
              <span>{thingsToFix(errorTotal)} · Show</span>
            </Button>
          )
        }
      >
        {!steps.isFirst && (
          <Button type="button" variant="outline" size="lg" className="flex-1 sm:flex-none" onClick={steps.back}>
            {PRODUCT_STEPS_FORM_COPY.back}
          </Button>
        )}
        {steps.isReview ? (
          <Button type="button" size="lg" className="flex-1" pending={isSubmitting} onClick={() => void putOnSale()}>
            {isSubmitting ? "Putting on sale…" : saveLabel}
          </Button>
        ) : (
          <Button type="button" size="lg" className="flex-1" onClick={steps.next}>
            {PRODUCT_STEPS_FORM_COPY.next}
          </Button>
        )}
      </ActionBar>
    </form>
  );
}


/** "On sale now" and what a shop adding many does next (Q16). */
function SuccessScreen({ product, onStartAnother }: { product: ProductDetails; onStartAnother: () => void }) {
  const router = useRouter();
  const base = useProductsBasePath();
  const share = () => {
    // Our origin is read from the page, never typed (CLAUDE.md "never hardcode our own origin").
    const url = new URL(ROUTES.product(product.slug), window.location.origin).toString();
    window.open(`https://wa.me/?text=${encodeURIComponent(`${product.name}\n${url}`)}`, "_blank");
  };
  return (
    <div className="space-y-6 rounded-card border border-border bg-card p-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10">
        <Icon name="success" size="xl" tone="success" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{PRODUCT_STEPS_FORM_COPY.onSaleNow}</h2>
        <p className="text-sm text-muted-foreground">{product.name} is live on your store.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button type="button" size="lg" onClick={share}>
          {PRODUCT_STEPS_FORM_COPY.shareOnWhatsapp}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            onStartAnother();
            router.push(`${base}/new`);
          }}
        >
          {PRODUCT_STEPS_FORM_COPY.addAnother}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push(`${base}/new?copyFrom=${encodeURIComponent(product.id)}`)}
        >
          {PRODUCT_STEPS_FORM_COPY.copyThisOne}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.push(`${base}/${product.id}`)}>
          {PRODUCT_STEPS_FORM_COPY.viewProduct}
        </Button>
      </div>
    </div>
  );
}
