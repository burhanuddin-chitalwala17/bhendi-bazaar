"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormController, FormInput, FormTextarea } from "../FormField";
import { ProductMediaManager } from "@/components/product/product-media-manager";
import { resolveShotList } from "@server/catalog/shot-list";
import type { ProductMediaDto, ProductMediaInput } from "@server/catalog/media";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import type { OrgSummary } from "@/domain/org";
import type { ProductFormInput } from "@/components/product/console/types";
import type { useServerForm } from "@/hooks/core/useServerForm";
import { CategoryPicker } from "./CategoryPicker";
import { CategoryChangeSheet } from "./CategoryChangeSheet";
import type { useCategoryChange } from "./useCategoryChange";
import { ProductFactFields } from "./ProductFactFields";
import { ProductFamilyField } from "./ProductFamilyField";
import { ProductFlagsFields } from "./ProductFlagsFields";
import { ProductOrgShippingFields, type LocationOption } from "./ProductOrgShippingFields";
import { alsoAsks, willAlsoAsk, type ChannelHint } from "./readiness-hints";
import { FIELD_STEP, MORE_OPTIONS_FIELDS, type ProductStepKey } from "./product-steps";

export type ProductForm = ReturnType<typeof useServerForm<ProductFormInput>>;
export type SectionKey = Exclude<ProductStepKey, "review">;

export interface ProductSectionsProps {
  form: ProductForm;
  /** The one section on screen; the others stay mounted, so an upload survives a move (ux "Slow"). */
  current: ProductStepKey;
  categories: { id: string; name: string; parentId?: string | null; shotList?: unknown; productType?: unknown }[];
  productTypes: ProductTypeRecord[];
  listingValues: Record<string, Array<{ key: string; label: string; orgId: string | null }>>;
  origins: Partial<Record<string, string>>;
  families: Array<{ id: string; name: string }>;
  orgs?: OrgSummary[];
  locations: LocationOption[];
  onLocationAdded: (location: LocationOption) => void;
  uploadEndpoints?: Parameters<typeof ProductMediaManager>[0]["endpoints"];
  /** Edit: the saved rows, so a video keeps its poster and state in the gallery editor. */
  savedMedia?: ProductMediaDto[];
  /** "Start from a product you already sell", at the top of Photos and video (Q15). */
  copyFrom?: ReactNode;
  categoryChange: ReturnType<typeof useCategoryChange>;
  hints: ChannelHint[];
}

/**
 * The four sections a product is filled in (product-form D1): one set of fields for the create
 * steps and the edit overview, so the two cannot drift. Only `current` decides which shows.
 */
export function ProductSections({
  form,
  current,
  categories,
  productTypes,
  listingValues,
  origins,
  families,
  orgs,
  locations,
  onLocationAdded,
  uploadEndpoints,
  savedMedia,
  copyFrom,
  categoryChange,
  hints,
}: ProductSectionsProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const orgId = watch("orgId") || "";
  const categoryId = watch("categoryId") || "";
  const [moreOpen, setMoreOpen] = useState<ReadonlySet<ProductStepKey>>(() => new Set());
  // A field under "More options" with an error opens it, or the refusal would sit out of sight.
  const moreHasError = (step: ProductStepKey) =>
    MORE_OPTIONS_FIELDS.some((field) => FIELD_STEP[field] === step && !!errors[field]);
  const isMoreOpen = (step: ProductStepKey) => moreOpen.has(step) || moreHasError(step);
  const toggleMore = (step: ProductStepKey) =>
    setMoreOpen((open) => {
      const next = new Set(open);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });

  return (
    <>
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
                      savedMedia={savedMedia}
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
    </>
  );
}

/** "{Channel} also asks: {fact}" in the step that holds those facts (R5, Q8). Silent when nothing is asked. */
export function AlsoAsks({ hints }: { hints: ChannelHint[] }) {
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
export function ReviewReadiness({
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
export function MoreOptions({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
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
function TagsField({ form }: { form: ProductForm }) {
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
