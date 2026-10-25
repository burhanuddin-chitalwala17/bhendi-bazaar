"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { useMutation } from "@/hooks/core/useMutation";
import { formatCurrency } from "@/lib/format";
import { orgUploadEndpoints } from "@/lib/image/upload-endpoints";
import { uploadBatch } from "@/lib/image/upload-batch";
import { cn } from "@/lib/utils";
import { buildImagePath } from "@server/catalog/image-paths";
import { settleListingSchema, type SettleListingFormValues } from "@/lib/validation/schemas/settle-listing.schema";
import { LEFT_OFF_REASON, SUGGESTION_KIND, type SettleDetailDTO, type SettleResultDTO, type SettleSideDTO } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { ListingImage } from "./listing-image";
import { MatchPicker } from "./match-picker";
import { SETTLE, SETTLE_ACTION, SETTLE_TOAST } from "./settle-copy";
import { SettleTypeQuestion } from "./settle-type-question";
import { ASK_ADMIN, FACTS_TOAST } from "./facts-copy";

const PRODUCT = "product";
const UPLOAD = "upload";

interface SettleFormProps {
  orgId: string;
  /** For the message a listing with no type of ours asks the admin with (marketplace-facts Q13). */
  shopName: string;
  orgCode: string;
  detail: SettleDetailDTO;
  categories: Array<{ id: string; name: string }>;
  /** The Listings page this came from. */
  backHref: string;
}

type Field = "title" | "description" | "photos";

/** A side's value of one field, for comparing and choosing (product-merge Q6). */
const valueOf = (side: SettleSideDTO, field: Field) =>
  field === "title" ? side.title : field === "description" ? side.description : side.photoUrls.length > 0 ? side.photoUrls : null;
const sizeOf = (side: SettleSideDTO, field: Field) => {
  const v = valueOf(side, field);
  return Array.isArray(v) ? v.length : (v?.length ?? 0);
};

/**
 * The Settle page's form (product-merge ux.md "Settle page"): which listings, whose content per
 * field, then price, SKU, category and stock. One request; the server decides everything else.
 */
export function SettleForm({ orgId, shopName, orgCode, detail, categories, backHref }: SettleFormProps) {
  const router = useRouter();
  const { primary, pair, product, mode } = detail;
  const [includePair, setIncludePair] = useState(pair?.reason === SUGGESTION_KIND.SAME_SKU);
  const sides = useMemo(() => (includePair && pair ? [primary, pair.side] : [primary]), [includePair, pair, primary]);

  // The more complete side starts chosen (Q6); a match keeps the product's own (Q13).
  const fuller = (field: Field) => {
    const best = [...sides].sort((a, b) => sizeOf(b, field) - sizeOf(a, field))[0];
    return best && sizeOf(best, field) > 0 ? best.listingId : null;
  };
  const initialChoice = (field: Field) => (product ? PRODUCT : (fuller(field) ?? (field === "photos" ? UPLOAD : PRODUCT)));
  const [choice, setChoice] = useState<Record<Field, string>>(() => ({
    title: initialChoice("title"),
    description: initialChoice("description"),
    photos: initialChoice("photos"),
  }));
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [slow, setSlow] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A side left out takes its choices with it.
  useEffect(() => {
    setChoice((current) => {
      const ids = new Set(sides.map((s) => s.listingId));
      const keep = (field: Field, value: string) =>
        value === PRODUCT || value === UPLOAD || ids.has(value) ? value : (fuller(field) ?? (field === "photos" ? UPLOAD : PRODUCT));
      return { title: keep("title", current.title), description: keep("description", current.description), photos: keep("photos", current.photos) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sides]);

  const lowest = (values: Array<number | null>) => {
    const known = values.filter((v): v is number => v !== null);
    return known.length > 0 ? Math.min(...known) : null;
  };
  const anyLive = sides.some((s) => s.live);
  const skus = [...new Set(sides.map((s) => s.sku))];
  const priceStart = lowest(sides.map((s) => s.pricePaise));
  const qtyStart = lowest(sides.map((s) => s.quantity)) ?? 0;

  const stockDefaults = product
    ? detail.locations.map((l) => {
        const row = product.stock.find((s) => s.locationId === l.id);
        return { locationId: l.id, quantity: row?.quantity ?? 0, seenQuantity: row?.quantity };
      })
    : detail.locations.slice(0, 1).map((l) => ({ locationId: l.id, quantity: qtyStart }));

  const form = useServerForm<SettleListingFormValues>({
    schema: settleListingSchema,
    defaultValues: {
      listingIds: sides.map((s) => s.listingId),
      productId: product?.id,
      sku: product ? undefined : primary.sku,
      price: product || priceStart === null ? undefined : priceStart / 100,
      categoryId: product ? undefined : (detail.defaultCategoryId ?? undefined),
      stock: stockDefaults,
      onSale: false,
    },
    // The choices are written into the values as they change (below), so validation sees them.
    submit: async (values) => (await channelsApiClient.settle(orgId, values)).result,
    onSuccess: (outcome) => {
      const result = outcome as SettleResultDTO;
      toast.success(
        result.mode === "match"
          ? SETTLE_TOAST.linked(result.productName)
          : result.archived
            ? SETTLE_TOAST.addedArchived(result.productName)
            : SETTLE_TOAST.added(result.productName),
      );
      router.push(backHref.replace("tab=notLinked", "tab=linked"));
    },
  });
  const { register, setValue, watch, formState } = form;

  // No type of ours fits: out of the to-do until one exists (marketplace-facts Q6).
  const park = useMutation(() => channelsApiClient.leaveOffListing(orgId, primary.channel, primary.listingId, LEFT_OFF_REASON.NO_TYPE), {
    showToast: false,
    onSuccess: () => {
      toast.success(FACTS_TOAST.parked);
      router.push(`${backHref}&left=1`);
    },
    onError: () => toast.error(SETTLE_TOAST.failed),
  });
  const errors = formState.errors;

  // What the owner chose becomes what is sent: listings, title, description and photo source.
  useEffect(() => {
    const pick = (field: Field) => sides.find((s) => s.listingId === choice[field]);
    setValue("listingIds", sides.map((s) => s.listingId));
    setValue("name", choice.title === PRODUCT ? undefined : (pick("title")?.title ?? primary.sku).slice(0, 250), {
      shouldValidate: formState.isSubmitted,
    });
    if (choice.description !== PRODUCT || product) {
      setValue("description", choice.description === PRODUCT ? undefined : pick("description")?.description?.slice(0, 5000));
    }
    setValue("photosFrom", choice.photos === PRODUCT || choice.photos === UPLOAD ? undefined : choice.photos, {
      shouldValidate: formState.isSubmitted,
    });
    if (choice.photos !== UPLOAD) setValue("uploadedPhoto", undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, sides]);

  // Stock changed meanwhile: reload, and the fresh counts replace what was typed.
  useEffect(() => {
    if (errors.stock) router.refresh();
  }, [errors.stock, router]);
  useEffect(() => {
    setValue("stock", stockDefaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(product?.stock)]);

  useEffect(() => {
    if (!form.isSubmitting) return setSlow(false);
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [form.isSubmitting]);

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { urls, firstError } = await uploadBatch([file], {
        endpoints: orgUploadEndpoints(orgId),
        pathFor: (f) => buildImagePath("org", f.name, "marketplace", orgCode),
      });
      if (!urls[0]) throw new Error(firstError ?? SETTLE_TOAST.failed);
      setValue("uploadedPhoto", urls[0], { shouldValidate: true });
      setChoice((c) => ({ ...c, photos: UPLOAD }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : SETTLE_TOAST.failed);
    } finally {
      setUploading(false);
    }
  };

  const productSide = product
    ? { id: PRODUCT, label: SETTLE.bhendiBazaar, title: product.name, description: product.description, photoUrls: product.photoUrls }
    : null;
  const options = (field: Field) => [
    ...(productSide ? [{ id: PRODUCT, label: productSide.label, value: field === "photos" ? productSide.photoUrls : productSide[field] }] : []),
    ...sides.map((s) => ({ id: s.listingId, label: s.label, value: valueOf(s, field) })),
  ];
  const fullest = (field: Field) => fuller(field);
  const uploadedPhoto = watch("uploadedPhoto");
  const noPhotoAnywhere = !product && sides.every((s) => s.photoUrls.length === 0);
  const noDescriptionAnywhere = !product && sides.every((s) => !s.description);

  const choiceGroup = (field: Field, heading: string) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{heading}</legend>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {options(field)
          .filter((o) => o.value !== null && (!Array.isArray(o.value) || o.value.length > 0))
          .map((o) => (
            <Button
              key={o.id}
              type="button"
              variant="outline"
              aria-pressed={choice[field] === o.id}
              onClick={() => setChoice((c) => ({ ...c, [field]: o.id }))}
              className={cn(
                "h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal p-3 text-left",
                choice[field] === o.id && "border-primary bg-primary/10",
              )}
            >
              {Array.isArray(o.value) ? (
                <span className="flex flex-wrap gap-1">
                  {o.value.slice(0, 5).map((url) => (
                    <ListingImage key={url} url={url} title={null} ours={o.id === PRODUCT} />
                  ))}
                </span>
              ) : (
                <span className={cn("text-sm", field === "description" && "whitespace-pre-line", field === "description" && !expanded && "line-clamp-4")}>
                  {o.value}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {o.label}
                {Array.isArray(o.value) ? ` · ${SETTLE.photoCount(o.value.length)}` : ""}
                {o.id === PRODUCT ? ` · ${SETTLE.kept}` : ""}
                {fullest(field) === o.id ? ` · ${SETTLE.moreComplete}` : ""}
              </span>
            </Button>
          ))}
      </div>
      {field === "description" && !expanded && (
        <Button type="button" variant="ghost" size="sm" className="self-start px-0" onClick={() => setExpanded(true)}>
          {SETTLE_ACTION.showAll}
        </Button>
      )}
      {field === "title" && errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      {field === "photos" && errors.photosFrom && (
        <div role="alert" className="flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-3 text-sm">
          <p>{errors.photosFrom.message}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" className="min-h-10">
              {SETTLE_ACTION.tryAgain}
            </Button>
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setChoice((c) => ({ ...c, photos: UPLOAD }))}>
              {SETTLE_ACTION.addPhoto}
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );

  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-5 pb-24 md:pb-6">
      {pair && (
        <div className="flex flex-col gap-2 rounded-card border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">
              {pair.reason === SUGGESTION_KIND.SAME_SKU ? SETTLE.sameSkuOn(pair.side.label) : SETTLE.looksLikeOn(pair.side.label)}
            </span>
            <Switch checked={includePair} onCheckedChange={setIncludePair} aria-label={SETTLE_ACTION.include} />
          </div>
          <p className="text-xs text-muted-foreground">
            {[pair.side.title, pair.side.externalId, pair.side.pricePaise !== null ? formatCurrency(pair.side.pricePaise) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {includePair && (
            <Button type="button" variant="ghost" size="sm" className="self-start px-0" onClick={() => setIncludePair(false)}>
              {SETTLE_ACTION.notThisOne}
            </Button>
          )}
        </div>
      )}

      {!product && !anyLive && (
        <div className="flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-3 text-sm">
          <p>{SETTLE.inactive(primary.label)}</p>
          <label className="flex items-center justify-between gap-3">
            <span>{SETTLE.putOnSale}</span>
            <Switch checked={watch("onSale") ?? false} onCheckedChange={(v) => setValue("onSale", v)} />
          </label>
        </div>
      )}

      {choiceGroup("title", SETTLE.title)}
      {noDescriptionAnywhere ? (
        <FormField id="settle-description" label={SETTLE.description} hint={SETTLE.noDescription} error={errors.description?.message}>
          <Textarea id="settle-description" rows={4} {...register("description")} />
        </FormField>
      ) : (
        choiceGroup("description", SETTLE.description)
      )}
      {noPhotoAnywhere || choice.photos === UPLOAD ? (
        <FormField id="settle-photo" label={SETTLE.photos} hint={noPhotoAnywhere ? SETTLE.noPhoto : undefined} error={errors.uploadedPhoto?.message}>
          <div className="flex items-center gap-3">
            {uploadedPhoto && <ListingImage url={uploadedPhoto} title={null} ours />}
            <input
              ref={fileInput}
              id="settle-photo"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void uploadPhoto(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" className="min-h-10" onClick={() => fileInput.current?.click()} aria-busy={uploading}>
              {uploading && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {SETTLE_ACTION.addPhoto}
            </Button>
          </div>
        </FormField>
      ) : (
        choiceGroup("photos", SETTLE.photos)
      )}

      {!product && (
        <>
          <FormField
            id="settle-price"
            label={SETTLE.price}
            required
            hint={SETTLE.priceHelp(
              sides.map((s) => `${s.label} ${s.pricePaise !== null ? formatCurrency(s.pricePaise) : "—"}`).join(" · "),
            )}
            error={errors.price?.message}
          >
            <Input id="settle-price" type="number" inputMode="decimal" step="0.01" min="0" {...register("price", { valueAsNumber: true })} />
          </FormField>

          <FormField id="settle-sku" label={SETTLE.sku} required hint={SETTLE.skuHelp} error={errors.sku?.message}>
            <Select id="settle-sku" {...register("sku")}>
              {skus.map((sku) => (
                <option key={sku} value={sku}>
                  {sku}
                  {sides.length > 1 && sides.every((s) => s.sku === sku) ? ` · ${SETTLE.skuBoth}` : ` · ${sides.find((s) => s.sku === sku)?.label}`}
                </option>
              ))}
            </Select>
          </FormField>
          {errors.sku && (
            <MatchPicker
              orgId={orgId}
              listingId={primary.listingId}
              label={primary.label}
              addNewHref={`/org/${orgId}/channels/settle?listing=${primary.listingId}`}
              trigger={
                <Button type="button" variant="outline" className="min-h-10 self-start">
                  {SETTLE_ACTION.matchInstead}
                </Button>
              }
            />
          )}

          {detail.type && (
            <SettleTypeQuestion
              label={primary.label}
              type={detail.type}
              categoryId={watch("categoryId")}
              message={ASK_ADMIN.message(shopName, primary.label, primary.title ?? primary.sku, primary.sku, detail.type.marketplaceType)}
              onCategory={(id) => setValue("categoryId", id, { shouldValidate: formState.isSubmitted })}
              onPark={() => void park.mutate().catch(() => undefined)}
            />
          )}
          <FormField id="settle-category" label={SETTLE.category} required error={errors.categoryId?.message}>
            <Select id="settle-category" {...register("categoryId")}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        </>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{SETTLE.quantity}</legend>
        {watch("stock").map((row, index) => {
          const location = detail.locations.find((l) => l.id === row.locationId);
          return (
            <FormField
              key={row.locationId}
              id={`settle-stock-${index}`}
              label={(product || detail.locations.length > 1) && location ? location.name : SETTLE.quantity}
              error={errors.stock?.[index]?.quantity?.message ?? (index === 0 ? errors.stock?.message : undefined)}
            >
              <Input
                id={`settle-stock-${index}`}
                type="number"
                inputMode="numeric"
                min="0"
                {...register(`stock.${index}.quantity`, { valueAsNumber: true })}
              />
            </FormField>
          );
        })}
        {!product && detail.locations.length > 1 && (
          <FormField id="settle-location" label={SETTLE.keptAt}>
            <Select
              id="settle-location"
              value={watch("stock")[0]?.locationId}
              onChange={(e) => setValue("stock", [{ locationId: e.target.value, quantity: watch("stock")[0]?.quantity ?? qtyStart }])}
            >
              {detail.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <p className="text-xs text-muted-foreground">
          {SETTLE.says(
            [
              ...sides.map((s) => `${s.label} says ${s.quantity ?? "—"}`),
              ...(product ? [`${SETTLE.bhendiBazaar} says ${product.stock.reduce((n, s) => n + s.quantity, 0)}`] : []),
            ].join(", "),
          )}
        </p>
        <p className="text-xs font-medium text-warning">{SETTLE.stockSyncNote}</p>
      </fieldset>

      {errors.listingIds && (
        <div role="alert" className="flex flex-col gap-2 rounded-card border border-destructive bg-destructive/10 p-3 text-sm">
          <p>{errors.listingIds.message}</p>
          <Button asChild variant="outline" className="min-h-10 self-start">
            <Link href={backHref}>{SETTLE_ACTION.backToListings}</Link>
          </Button>
        </div>
      )}
      {form.formError && (
        <p role="alert" className="rounded-card border border-destructive bg-destructive/10 p-3 text-sm">
          {form.formError}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-tabbar z-10 border-t bg-card p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" className="min-h-10 w-full md:w-auto" aria-busy={form.isSubmitting}>
          {form.isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {form.isSubmitting
            ? product
              ? SETTLE_ACTION.saving
              : SETTLE_ACTION.adding
            : product
              ? SETTLE_ACTION.linkAndSave
              : SETTLE_ACTION.addProduct}
        </Button>
        {slow && <p className="mt-1 text-xs text-muted-foreground">{SETTLE_ACTION.stillSaving}</p>}
      </div>
    </form>
  );
}
