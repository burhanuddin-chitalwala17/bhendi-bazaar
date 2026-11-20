"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { ActionBar } from "@/components/shared/action-bar";
import { FormInput, FormTextarea } from "@/components/shared/forms/FormField";
import { paiseToRupees, rupeesToPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LISTING_FIELD, LISTING_STATUS, type ListingField, type ListingIssue, type ListingScreenDTO } from "@server/channels/platform-listing.types";

import { ago } from "./listing-copy";
import { FieldIssues, FieldLine, FieldShell, OwnerChip } from "./listing-field";
import { ListingPhotosField } from "./listing-photos-field";
import { FIELD_NAME, LISTING, rupees, statusText } from "./platform-listing-copy";
import { useListingForm } from "./useListingForm";
import { ROUTES } from "@server/shared/routes";

const now = () => Date.now();

/**
 * The listing screen's form (channel-listings ux.md "Listing screen"): every field the product's
 * or the listing's own, what the marketplace has under it, and Save. Fields the marketplace does
 * not let us write show its copy and where to change it (Q4).
 */
export function ListingEditor({ orgId, screen }: { orgId: string; screen: ListingScreenDTO }) {
  const { form, overrides, isOwn, setOwn, backToProduct, allBackToProduct } = useListingForm(orgId, screen);
  const { label, rules, product, theirs, issues } = screen;
  const errors = form.formState.errors.overrides;
  const writable = (f: ListingField) => rules.writable.includes(f);
  const fieldIssues = (f: ListingField) => issues.filter((i: ListingIssue) => i.field === f);

  const chip = (f: ListingField) =>
    !writable(f) ? <OwnerChip kind="theirs" text={LISTING.catalogue(label)} /> : isOwn(f) ? <OwnerChip kind="own" text={LISTING.changedFor(label)} /> : <OwnerChip kind="product" text={LISTING.sameAsProduct} />;

  const productLine = (f: ListingField, text: string) =>
    isOwn(f) ? <FieldLine action={LISTING.useProducts} onAction={() => backToProduct(f)}>{LISTING.productSays(text)}</FieldLine> : null;

  const theirLine = (f: ListingField, shown: string | null, differs: boolean, take: () => void) =>
    shown && differs && writable(f) ? (
      <>
        <FieldLine action={LISTING.takeTheirs(label)} onAction={take}>{LISTING.onThereNow(label, shown)}</FieldLine>
        {theirs.readAt && <FieldLine>{LISTING.readAgo(ago(theirs.readAt, now()))}</FieldLine>}
      </>
    ) : null;

  const counter = (value: string, max: number | null, field: string) => {
    if (!max || value.length < max * 0.8) return null;
    return value.length > max ? <p className="text-xs text-warning">{LISTING.overLimit(label, max, field)}</p> : <FieldLine>{LISTING.count(value.length, max)}</FieldLine>;
  };

  const title = overrides.title ?? product.title;
  const priceRupees = overrides.price ?? paiseToRupees(product.price);
  const features = overrides.features ?? product.features;
  const description = overrides.description ?? product.description;
  const photos = overrides.photos ?? product.photos;
  const listed = overrides.listed ?? product.listed;
  const anyOwn = Object.values(overrides).some((v) => v !== undefined);

  return (
    <form onSubmit={form.onSubmit} noValidate className="flex flex-col gap-4 pb-24 md:pb-4">
      <section className="flex flex-col rounded-card border bg-card p-4">
        {writable(LISTING_FIELD.TITLE) ? (
          <FieldShell
            id="field-title"
            name={FIELD_NAME.title}
            chip={chip(LISTING_FIELD.TITLE)}
            lines={
              <>
                {counter(title, rules.limits.title, "title")}
                {productLine(LISTING_FIELD.TITLE, product.title)}
                {theirLine(LISTING_FIELD.TITLE, theirs.title, theirs.title !== title, () => theirs.title && setOwn("title", theirs.title))}
                <FieldIssues issues={fieldIssues(LISTING_FIELD.TITLE)} label={label} />
              </>
            }
          >
            <FormInput aria-label={FIELD_NAME.title} value={title} onChange={(e) => setOwn("title", e.target.value)} error={errors?.title?.message} />
          </FieldShell>
        ) : (
          <NotWritable name={FIELD_NAME.title} chipNode={chip(LISTING_FIELD.TITLE)} theirs={theirs.title} ours={product.title} where={rules.editIn} />
        )}

        <FieldShell
          id="field-price"
          name={FIELD_NAME.price}
          chip={chip(LISTING_FIELD.PRICE)}
          lines={
            <>
              {rules.wholeRupees && !Number.isNaN(priceRupees) && rupeesToPaise(priceRupees) % 100 !== 0 && (
                <FieldLine>{LISTING.wholeRupees(rupees(Math.floor(rupeesToPaise(priceRupees) / 100) * 100))}</FieldLine>
              )}
              {productLine(LISTING_FIELD.PRICE, rupees(product.price))}
              {theirLine(LISTING_FIELD.PRICE, theirs.price !== null ? rupees(theirs.price) : null, theirs.price !== null && theirs.price !== rupeesToPaise(priceRupees || 0), () => theirs.price !== null && setOwn("price", paiseToRupees(theirs.price)))}
              <FieldIssues issues={fieldIssues(LISTING_FIELD.PRICE)} label={label} />
            </>
          }
        >
          <FormInput
            aria-label={FIELD_NAME.price}
            type="number"
            inputMode="decimal"
            step={rules.wholeRupees ? "1" : "0.01"}
            value={Number.isNaN(priceRupees) ? "" : priceRupees}
            onChange={(e) => setOwn("price", e.target.valueAsNumber)}
            error={errors?.price?.message}
          />
        </FieldShell>

        {writable(LISTING_FIELD.PHOTOS) ? (
          <FieldShell
            id="field-photos"
            name={FIELD_NAME.photos}
            chip={chip(LISTING_FIELD.PHOTOS)}
            lines={
              <>
                {productLine(LISTING_FIELD.PHOTOS, `${product.photos.length} photos`)}
                <FieldIssues issues={fieldIssues(LISTING_FIELD.PHOTOS)} label={label} />
              </>
            }
          >
            <ListingPhotosField photos={screen.photos} chosen={photos} rules={rules} label={label} onChange={(next) => setOwn("photos", next)} />
          </FieldShell>
        ) : (
          <NotWritable name={`${FIELD_NAME.photos} · ${FIELD_NAME.features} · ${FIELD_NAME.description}`} chipNode={chip(LISTING_FIELD.PHOTOS)} theirs={null} ours={null} where={rules.editIn} />
        )}

        {writable(LISTING_FIELD.FEATURES) && (
          <FieldShell
            id="field-features"
            name={FIELD_NAME.features}
            chip={chip(LISTING_FIELD.FEATURES)}
            lines={
              <>
                {productLine(LISTING_FIELD.FEATURES, product.features.join(" · ") || LISTING.none)}
                {theirLine(LISTING_FIELD.FEATURES, theirs.features?.join(" · ") ?? null, !!theirs.features && theirs.features.join("\n") !== features.join("\n"), () => theirs.features && setOwn("features", theirs.features))}
                <FieldIssues issues={fieldIssues(LISTING_FIELD.FEATURES)} label={label} />
              </>
            }
          >
            <FeaturesInput
              features={features}
              max={rules.limits.feature}
              label={label}
              errors={Array.isArray(errors?.features) ? errors.features.map((e) => e?.message) : []}
              onChange={(next) => setOwn("features", next)}
            />
          </FieldShell>
        )}

        {writable(LISTING_FIELD.DESCRIPTION) && (
          <FieldShell
            id="field-description"
            name={FIELD_NAME.description}
            chip={chip(LISTING_FIELD.DESCRIPTION)}
            lines={
              <>
                {counter(description, rules.limits.description, "description")}
                {productLine(LISTING_FIELD.DESCRIPTION, product.description.slice(0, 120))}
                {theirLine(LISTING_FIELD.DESCRIPTION, theirs.description?.slice(0, 160) ?? null, !!theirs.description && theirs.description !== description, () => theirs.description && setOwn("description", theirs.description))}
                <FieldIssues issues={fieldIssues(LISTING_FIELD.DESCRIPTION)} label={label} />
              </>
            }
          >
            <FormTextarea aria-label={FIELD_NAME.description} rows={5} value={description} onChange={(e) => setOwn("description", e.target.value)} error={errors?.description?.message} />
          </FieldShell>
        )}

        <FieldShell id="field-listed" name={`${LISTING.onSale} on ${label}`} chip={chip(LISTING_FIELD.LISTED)} lines={<FieldIssues issues={fieldIssues(LISTING_FIELD.LISTED)} label={label} />}>
          <label className="flex min-h-10 items-center justify-between gap-3 text-sm font-medium">
            <span>{listed ? LISTING.onSale : LISTING.paused}</span>
            <Switch checked={listed} onCheckedChange={(on) => setOwn("listed", on)} aria-label={`${LISTING.onSale} on ${label}`} />
          </label>
        </FieldShell>

        {anyOwn && (
          <Button type="button" variant="link" size="sm" className="h-auto min-h-10 self-start p-0" onClick={allBackToProduct}>
            {LISTING.useProductsAll}
          </Button>
        )}
      </section>

      <SaveBar orgId={orgId} screen={screen} dirty={form.formState.isDirty} pending={form.isSubmitting} />
    </form>
  );
}

/** A field the marketplace keeps in its own catalogue (channel-listings Q4): theirs shown, ours to copy. */
function NotWritable({ name, chipNode, theirs, ours, where }: { name: string; chipNode: React.ReactNode; theirs: string | null; ours: string | null; where: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!ours) return;
    try {
      await navigator.clipboard.writeText(ours);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <FieldShell
      id={`field-${name}`}
      name={name}
      chip={chipNode}
      lines={
        <>
          <FieldLine>{LISTING.notWritable(where)}</FieldLine>
          {ours && <FieldLine action={copied ? LISTING.copied : LISTING.copyOurs} onAction={() => void copy()}>{copied ? ours.slice(0, 80) : null}</FieldLine>}
        </>
      }
    >
      {theirs && <p className="rounded-field border bg-muted px-3 py-2 text-sm">{theirs}</p>}
    </FieldShell>
  );
}

function FeaturesInput({ features, max, label, errors, onChange }: { features: string[]; max: number | null; label: string; errors: Array<string | undefined>; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {features.map((feature, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <FormInput
              aria-label={`${FIELD_NAME.features} ${index + 1}`}
              value={feature}
              onChange={(e) => onChange(features.map((f, i) => (i === index ? e.target.value : f)))}
              error={errors[index] ?? (max && feature.length > max ? LISTING.overLimit(label, max, "point") : undefined)}
            />
          </div>
          <Button type="button" variant="ghost" shape="icon" className="size-10" aria-label={LISTING.removePoint(index + 1)} onClick={() => onChange(features.filter((_, i) => i !== index))}>
            <Icon name="close" />
          </Button>
        </div>
      ))}
      {features.length < 5 && (
        <Button type="button" variant="outline" size="sm" className="min-h-10 self-start" onClick={() => onChange([...features, ""])}>
          <Icon name="add" /> {LISTING.addPoint}
        </Button>
      )}
    </div>
  );
}

/** Save while there are edits; once saved, what waits and the way to publish it (Q15, publish R1). */
function SaveBar({ orgId, screen, dirty, pending }: { orgId: string; screen: ListingScreenDTO; dirty: boolean; pending: boolean }) {
  const waiting = screen.waitingFields.length;
  // A send still out is refused by publish, so it is not offered until the marketplace answers.
  const sending = screen.status.status === LISTING_STATUS.SENT || screen.status.status === LISTING_STATUS.CHECKING;
  const status = sending ? statusText(screen.status, screen.label, (iso) => ago(iso, now())) : waiting > 0 ? LISTING.waiting(waiting) : LISTING.nothingWaiting;
  return (
    <ActionBar
      className="-mx-4 md:mx-0"
      status={dirty ? null : <span className={cn(waiting > 0 && !sending && "font-semibold")}>{status}</span>}
    >
      {dirty || waiting === 0 || sending ? (
        <Button type="submit" size="sm" className="min-h-10" pending={pending}>
          {LISTING.save}
        </Button>
      ) : (
        <Button asChild size="sm" className="min-h-10">
          <Link href={`${ROUTES.org.channelPublish(orgId, screen.channel)}?listing=${screen.id}`}>{LISTING.reviewAndPublish}</Link>
        </Button>
      )}
    </ActionBar>
  );
}
