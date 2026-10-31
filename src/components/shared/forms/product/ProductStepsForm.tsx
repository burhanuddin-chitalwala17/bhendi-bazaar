"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Info, Loader2 } from "lucide-react";
import type { FieldErrors } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormController, FormInput, FormTextarea } from "../FormField";
import { ProductMediaManager } from "@/components/product/product-media-manager";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";
import { resolveShotList } from "@server/catalog/shot-list";
import { resolveProductType } from "@server/listing/product-type";
import type { ProductMediaInput } from "@server/catalog/media";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import type { OrgSummary } from "@/domain/org";
import type { ProductDetails, ProductFormInput } from "@/components/product/console/types";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import type { useServerForm } from "@/hooks/core/useServerForm";
import { CategoryPicker } from "./CategoryPicker";
import { CategoryChangeSheet } from "./CategoryChangeSheet";
import { useCategoryChange } from "./useCategoryChange";
import { keepAsked } from "./category-change";
import { BuyerPreview } from "./BuyerPreview";
import { ProductFactFields } from "./ProductFactFields";
import { ProductFamilyField } from "./ProductFamilyField";
import { ProductFlagsFields } from "./ProductFlagsFields";
import { ProductOrgShippingFields, type LocationOption } from "./ProductOrgShippingFields";
import type { useProductSteps } from "./useProductSteps";
import { useReadinessHints } from "./useReadinessHints";
import { alsoAsks, hintsFrom, willAlsoAsk, type ChannelHint } from "./readiness-hints";
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
  orgs?: OrgSummary[];
  locations: LocationOption[];
  onLocationAdded: (location: LocationOption) => void;
  uploadEndpoints?: Parameters<typeof ProductMediaManager>[0]["endpoints"];
  /** "Start from a product you already sell", rendered at the top of Photos and video (Q15). */
  copyFrom?: ReactNode;
  /** False for a shop selling nowhere else: no hint is asked for and none shows (R5). */
  sellsElsewhere: boolean;
  /** The product just put on sale; set, the success screen replaces the steps (Q16). */
  created: ProductDetails | null;
  onStartAnother: () => void;
}

const isMoreOptionsField = (path: string) => (MORE_OPTIONS_FIELDS as readonly string[]).includes(path.split(".")[0]);

const STEP_INTRO: Partial<Record<ProductStepKey, string>> = {
  photos: "Start with photos. Tap 'Cover' on the one buyers see first.",
  review: "This is how buyers will see it.",
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
 * the steps only choose which fields are on screen. "Next" never validates; "Put on sale" submits.
 */
export function ProductStepsForm({
  form,
  steps,
  categories,
  productTypes,
  listingValues,
  origins,
  families,
  orgs,
  locations,
  onLocationAdded,
  uploadEndpoints,
  copyFrom,
  sellsElsewhere,
  created,
  onStartAnother,
}: ProductStepsFormProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formError,
    clearFormError,
    formState: { errors, isSubmitting },
  } = form;
  const [moreOpen, setMoreOpen] = useState<ReadonlySet<ProductStepKey>>(() => new Set());
  const counts = errorCountsByStep(errors);
  const errorTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const orgId = watch("orgId") || "";
  const categoryId = watch("categoryId") || "";
  const typeKey = useMemo(() => resolveProductType(categoryId, categories), [categoryId, categories]);
  const productType = useMemo(() => productTypes.find((type) => type.key === typeKey) ?? null, [productTypes, typeKey]);
  const problems = useProblems(form, errors, steps.isReview, productType);
  // Readiness hints (D4): advice from the unsaved values, re-checked as the shop moves between steps.
  const readiness = useReadinessHints(sellsElsewhere ? orgId : "", productType, steps.current, form.getValues);
  const hints = hintsFrom(readiness.verdicts, productType);
  // A category of another type names the answers it would leave behind first (D5, R6).
  const categoryChange = useCategoryChange(categories, productTypes, form.getValues, (id) =>
    setValue("categoryId", id, { shouldDirty: true, shouldValidate: !!errors.categoryId }),
  );

  // A field under "More options" with an error opens it, or the refusal would sit out of sight.
  const moreHasError = (step: ProductStepKey) =>
    MORE_OPTIONS_FIELDS.some((field) => FIELD_STEP[field] === step && !!errors[field]);
  const isMoreOpen = (step: ProductStepKey) => moreOpen.has(step) || moreHasError(step);
  const toggleMore = (step: ProductStepKey) =>
    setMoreOpen((current) => {
      const next = new Set(current);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });

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
        <nav aria-label="Steps" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:col-span-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 lg:col-span-3">
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
                {done && <Check aria-hidden />}
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
          <section hidden={current !== "photos"} className="space-y-4">
              {copyFrom}
              {uploadEndpoints ? (
                <FormController
                  name="media"
                  control={control}
                  render={({ field }) => (
                    <ProductMediaManager
                      value={field.value as ProductMediaInput[]}
                      onChange={field.onChange}
                      endpoints={uploadEndpoints}
                      shotList={resolveShotList(watch("categoryId"), categories)}
                      orgId={orgId || undefined}
                      identifier={watch("name")}
                      orgCode={orgs?.find((org) => org.id === orgId)?.code}
                    />
                  )}
                />
              ) : null}
              {errors.media && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.media.message ?? errors.media.root?.message}
                </p>
              )}
          </section>

          <section hidden={current !== "what"} className="space-y-4">
              <FormController
                name="categoryId"
                control={control}
                render={({ field, id }) => (
                  <CategoryPicker
                    id={`${id}-picker`}
                    value={(field.value as string) ?? ""}
                    onChange={categoryChange.request}
                    categories={categories}
                    error={errors.categoryId?.message}
                  />
                )}
              />
              <FormInput
                label="Name"
                required
                placeholder="e.g., Velvet Embroidered Kurta"
                {...register("name")}
                error={errors.name?.message}
              />
              <FormTextarea
                label="Description"
                required
                rows={4}
                placeholder="What it is, what it is made of, how it fits"
                {...register("description")}
                error={errors.description?.message}
              />
              <MoreOptions open={isMoreOpen("what")} onToggle={() => toggleMore("what")}>
                <TagsField form={form} />
                <ProductFlagsFields control={control} />
                <ProductFamilyField
                  register={register}
                  setValue={setValue}
                  errors={errors}
                  orgId={orgId}
                  categoryId={categoryId}
                  families={families}
                />
              </MoreOptions>
              <CategoryChangeSheet
                pending={categoryChange.pending}
                onKeep={categoryChange.keep}
                onChange={categoryChange.confirm}
              />
          </section>

          <section hidden={current !== "price"} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  label="Price (₹)"
                  required
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0"
                  {...register("price", { valueAsNumber: true })}
                  error={errors.price?.message}
                />
                <FormInput
                  label="Sale price (₹)"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Optional"
                  {...register("salePrice", { valueAsNumber: true })}
                  error={errors.salePrice?.message}
                  hint="Leave empty if it is not on sale."
                />
              </div>
              <ProductOrgShippingFields
                register={register}
                errors={errors}
                watch={watch}
                orgs={orgs}
                locations={locations}
                onLocationAdded={onLocationAdded}
              />
              <FormInput
                label="Packed weight (kg)"
                required
                type="number"
                inputMode="decimal"
                step="0.001"
                placeholder="0.6"
                {...register("weight", { valueAsNumber: true })}
                error={errors.weight?.message}
                hint="With its packing. 0.6 means 600 g."
              />
              <MoreOptions open={isMoreOpen("price")} onToggle={() => toggleMore("price")}>
                <FormInput label="SKU (your own code)" placeholder="e.g., VEK-001" {...register("sku")} error={errors.sku?.message} />
                <FormInput
                  label="Tell me when stock is below"
                  type="number"
                  inputMode="numeric"
                  placeholder="10"
                  {...register("lowStockThreshold", { valueAsNumber: true })}
                  error={errors.lowStockThreshold?.message}
                />
              </MoreOptions>
          </section>

          <section hidden={current !== "details"} className="space-y-4">
            <AlsoAsks hints={hints} />
            <ProductFactFields
              control={control}
              register={register}
              errors={errors}
              setValue={setValue}
              families={families}
              orgId={orgId}
              categoryId={watch("categoryId") || ""}
              categories={categories}
              productTypes={productTypes}
              initialValues={listingValues}
              origins={origins}
              withFamily={false}
            />
          </section>

          <section hidden={current !== "review"} className="space-y-4">
              <div className="lg:hidden">{preview}</div>
              <ReviewReadiness
                hints={hints}
                checking={readiness.loading}
                storeReady={problems.length === 0}
                onOpenDetails={() => steps.goTo("details")}
              />
              {problems.length > 0 && (
                <ul className="space-y-2" aria-label="Still to fix">
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
                Try again
              </Button>
            </div>
          )}
        </div>

        <aside className="hidden lg:col-span-3 lg:block" aria-label="Buyer preview">
          {preview}
        </aside>
      </div>

      {/* The org portal has no tab bar, so the bar sits on the screen's own edge. */}
      <div className="sticky bottom-0 z-30 -mx-4 space-y-2 border-t border-border bg-background px-4 pb-safe pt-3 md:mx-0 md:px-0">
        {errorTotal > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-between text-destructive"
            onClick={() => steps.showFirstError(errors)}
          >
            <span>{thingsToFix(errorTotal)} · Show</span>
          </Button>
        )}
        <div className="flex gap-2">
          {!steps.isFirst && (
            <Button type="button" variant="outline" size="lg" className="flex-1 sm:flex-none" onClick={steps.back}>
              Back
            </Button>
          )}
          {steps.isReview ? (
            <Button type="button" size="lg" className="flex-1" aria-busy={isSubmitting} onClick={() => void putOnSale()}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Putting on sale…" : "Put on sale"}
            </Button>
          ) : (
            <Button type="button" size="lg" className="flex-1" onClick={steps.next}>
              Next
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

/** "{Channel} also asks: {fact}" in the step that holds those facts (R5, Q8). Silent when nothing is asked. */
function AlsoAsks({ hints }: { hints: ChannelHint[] }) {
  const asking = hints.filter((hint) => hint.asks.length > 0);
  if (asking.length === 0) return null;
  return (
    <ul aria-label="What other places ask" className="space-y-1 rounded-card border border-border bg-muted/40 p-3 text-sm">
      {asking.map((hint) => (
        <li key={hint.channel} className="flex items-start gap-2">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{alsoAsks(hint)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Review's readiness lines (R3, R5; ux Review Partial and Loading). A shop selling nowhere else sees
 * nothing. Each ask opens Details; none of it holds up "Put on sale" (ADR-0053).
 */
function ReviewReadiness({
  hints,
  checking,
  storeReady,
  onOpenDetails,
}: {
  hints: ChannelHint[];
  checking: boolean;
  storeReady: boolean;
  onOpenDetails: () => void;
}) {
  if (checking && hints.length === 0) {
    return <p className="animate-pulse text-sm text-muted-foreground">Checking…</p>;
  }
  if (hints.length === 0) return null;
  return (
    <div aria-label="Where it will sell" className={cn("space-y-2 rounded-card border border-border p-3 text-sm", checking && "animate-pulse")}>
      {checking && <p className="text-muted-foreground">Checking…</p>}
      {storeReady && (
        <p className="flex items-center gap-2 text-success">
          <Check aria-hidden className="size-4 shrink-0" />
          Ready for your store
        </p>
      )}
      <ul className="space-y-2">
        {hints.map((hint) =>
          hint.asks.length > 0 ? (
            <li key={hint.channel} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span>{willAlsoAsk(hint)}</span>
              <Button type="button" variant="outline" size="sm" onClick={onOpenDetails}>
                Add {hint.asks[0].toLowerCase()}
              </Button>
            </li>
          ) : hint.ready ? (
            <li key={hint.channel} className="flex items-center gap-2 text-muted-foreground">
              <Check aria-hidden className="size-4 shrink-0" />
              Ready for {hint.label}
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

/** A closed disclosure for the seldom-used fields of a step (R2, Q7). */
function MoreOptions({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="rounded-card border border-border">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        className="h-auto w-full justify-between whitespace-normal px-4 py-3"
        onClick={onToggle}
      >
        More options
        <ChevronDown aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </Button>
      {open && <div className="space-y-4 border-t border-border p-4">{children}</div>}
    </div>
  );
}

/** Tags as one line of comma-separated words; the text is kept as typed, the list is what saves. */
function TagsField({ form }: { form: Form }) {
  const {
    setValue,
    getValues,
    formState: { errors },
  } = form;
  const [text, setText] = useState(() => (getValues("tags") ?? []).join(", "));
  return (
    <FormController
      name="tags"
      control={form.control}
      label="Tags"
      hint="Words buyers might search for, separated by commas."
      error={errors.tags?.message}
      render={({ id }) => (
        <Input
          id={id}
          value={text}
          placeholder="attar, velvet, festive"
          onChange={(event) => {
            setText(event.target.value);
            setValue(
              "tags",
              event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
              { shouldDirty: true },
            );
          }}
        />
      )}
    />
  );
}

/** "On sale now" and what a shop adding many does next (Q16). */
function SuccessScreen({ product, onStartAnother }: { product: ProductDetails; onStartAnother: () => void }) {
  const router = useRouter();
  const base = useProductsBasePath();
  const share = () => {
    // Our origin is read from the page, never typed (CLAUDE.md "never hardcode our own origin").
    const url = new URL(`/product/${product.slug}`, window.location.origin).toString();
    window.open(`https://wa.me/?text=${encodeURIComponent(`${product.name}\n${url}`)}`, "_blank");
  };
  return (
    <div className="space-y-6 rounded-card border border-border bg-card p-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10">
        <Check className="size-7 text-success" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">On sale now</h2>
        <p className="text-sm text-muted-foreground">{product.name} is live on your store.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button type="button" size="lg" onClick={share}>
          Share on WhatsApp
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
          Add another
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push(`${base}/new?copyFrom=${encodeURIComponent(product.id)}`)}
        >
          Copy this one
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.push(`${base}/${product.id}`)}>
          View product
        </Button>
      </div>
    </div>
  );
}
