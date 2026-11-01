"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useServerForm } from "@/hooks/core/useServerForm";
import { paiseToRupees } from "@/lib/format";
import { listingSaveSchema, type ListingSaveInput } from "@/lib/validation/schemas/platform-listing.schema";
import type { ListingField, ListingScreenDTO } from "@server/channels/platform-listing.types";

import { listingsApiClient } from "./listingsApiClient";
import { LISTING } from "./platform-listing-copy";

type Overrides = NonNullable<ListingSaveInput["overrides"]>;

/** The listing's own values as the form holds them: price in rupees, absent keys inherited (channel-listings D2). */
function formOverrides(screen: ListingScreenDTO): Overrides {
  const out: Overrides = {};
  const { own, values } = screen;
  if (own.title) out.title = values.title;
  if (own.price) out.price = paiseToRupees(values.price);
  if (own.photos) out.photos = values.photos;
  if (own.features) out.features = values.features;
  if (own.description) out.description = values.description;
  if (own.listed) out.listed = values.listed;
  return out;
}

const strip = (o: Overrides): Overrides => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Overrides;

/**
 * The listing screen's form (channel-listings Q8, Q15): which fields are the listing's own, what each
 * shows, and the save. Saving sends nothing to the marketplace; it reports what now waits.
 */
export function useListingForm(orgId: string, screen: ListingScreenDTO) {
  const router = useRouter();
  const defaults = useMemo(() => ({ seenVersion: screen.version, overrides: formOverrides(screen) }), [screen]);
  const form = useServerForm<ListingSaveInput>({
    schema: listingSaveSchema,
    defaultValues: defaults,
    prepare: (values) => ({ ...values, overrides: strip(values.overrides ?? {}) }),
    submit: (data) => listingsApiClient.save(orgId, screen.productId, screen.channel, data),
    onSuccess: (result) => {
      toast.success(LISTING.savedWaiting((result as { waiting: number }).waiting, screen.label));
      router.refresh();
    },
    fallbackMessage: LISTING.saveFailed,
  });
  const { reset, watch, setValue } = form;
  // A refresh after a save brings the new version; the form starts again from it.
  useEffect(() => reset(defaults), [defaults, reset]);

  const overrides = watch("overrides") ?? {};
  const isOwn = (field: ListingField) => overrides[field] !== undefined;
  const setOwn = <F extends keyof Overrides>(field: F, value: Overrides[F]) =>
    setValue(`overrides.${field}` as const, value as never, { shouldDirty: true });
  const backToProduct = (field: ListingField) => setValue(`overrides.${field}` as const, undefined as never, { shouldDirty: true });
  const allBackToProduct = () => setValue("overrides", {}, { shouldDirty: true });

  return { form, overrides, isOwn, setOwn, backToProduct, allBackToProduct };
}
