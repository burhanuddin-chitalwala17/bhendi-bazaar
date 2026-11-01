"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import { OptionalRow } from "./section-card";
import {
  AboutSection,
  EssentialsSection,
  PersonSection,
  PlaceSection,
  PromiseSection,
  SocialSection,
  type SectionProps,
} from "./shop-details-sections";
import { OPTIONAL_ROWS, SHOP_DETAILS_COPY } from "./shop-details-copy";
import { ShopPreview } from "./shop-preview";
import { SaveBar } from "./save-bar";
import { SaveBarProvider, useSaveBar } from "./useSaveBar";
import { ShopLinkRow, ShopNameRow, ShopPrivatePart, type ContactProps } from "./shop-private-part";

/** ux First use: none of the three essentials yet. Name is always there, so logo and line decide. */
const essentialsDone = (d: ShopDetailsDto) => Boolean(d.logoUrl) && Boolean(d.tagline);
const anyEssential = (d: ShopDetailsDto) => Boolean(d.logoUrl) || Boolean(d.tagline);
const anyOptional = (d: ShopDetailsDto) =>
  Boolean(d.about || d.location || d.ownerName || d.ownerRole || d.ownerQuote || d.ownerPhotoUrl || d.promiseNote) ||
  Object.values(d.social).some(Boolean);

/**
 * Shop details (org-profile D2): "Buyers see this" with essentials first, each optional row collapsed and saying
 * what it adds, and one Save for every change (Q30). Holds the page's version, so each section's
 * write carries the latest one (Q21), and the draft the `lg:` preview draws (D10).
 */
export function ShopDetailsEditor({
  orgId,
  initial,
  oldAddressWorksUntil,
  returnTo = null,
}: {
  orgId: string;
  initial: ShopDetailsDto;
  /** ISO, from `storefrontService.previewChange`: the server's own hold window for the link row. */
  oldAddressWorksUntil: string;
  /** Opened from Home's setup list: once logo and line are both in, go back there (D8). */
  returnTo?: string | null;
}) {
  const router = useRouter();
  const [details, setDetails] = useState(initial);
  const [draft, setDraft] = useState<Partial<ShopDetailsDto>>({});
  const version = useRef(initial.updatedAt);
  // The org's own version: name, mobile and email live on Org, not the profile (D7).
  const contactVersion = useRef(initial.contactUpdatedAt);

  const onSaved = useCallback((next: ShopDetailsDto) => {
    version.current = next.updatedAt;
    contactVersion.current = next.contactUpdatedAt;
    setDetails(next);
    if (returnTo && essentialsDone(next)) router.push(returnTo);
  }, [returnTo, router]);
  const onDraft = useCallback((part: Partial<ShopDetailsDto>) => setDraft((d) => ({ ...d, ...part })), []);
  // The page keys this editor on the read's version, so a refresh with newer values remounts it.
  const onLoadLatest = useCallback(() => router.refresh(), [router]);
  const bar = useSaveBar();

  const props: SectionProps = { orgId, details, version: () => version.current, onSaved, onLoadLatest, onDraft };
  const contact: ContactProps = { orgId, details, contactVersion: () => contactVersion.current, onSaved, onLoadLatest };
  const lead = !anyEssential(details)
    ? SHOP_DETAILS_COPY.firstUse
    : essentialsDone(details) && !anyOptional(details)
      ? SHOP_DETAILS_COPY.empty
      : null;

  return (
    <SaveBarProvider value={bar.api}>
    <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
      <div className="space-y-6 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Eye aria-hidden className="size-4" />
            {SHOP_DETAILS_COPY.buyersPart}
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/store/${details.handle}`} target="_blank">
              <ExternalLink />
              {SHOP_DETAILS_COPY.seeAsBuyer}
            </Link>
          </Button>
        </div>
        {lead && <p className="text-sm text-muted-foreground">{lead}</p>}

        <Card>
          <CardHeader>
            <CardTitle>{SHOP_DETAILS_COPY.essentialsHeader}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ShopNameRow {...contact} />
            <EssentialsSection {...props} />
            <ShopLinkRow orgId={orgId} handle={details.handle} oldAddressWorksUntil={oldAddressWorksUntil} />
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h3 className="font-heading text-base font-semibold">{SHOP_DETAILS_COPY.optionalHeader}</h3>
          <OptionalRow id="about" {...OPTIONAL_ROWS.about} open={Boolean(details.about)}>
            <AboutSection {...props} />
          </OptionalRow>
          <OptionalRow id="place" {...OPTIONAL_ROWS.place} open={Boolean(details.location)}>
            <PlaceSection {...props} />
          </OptionalRow>
          <OptionalRow id="person" {...OPTIONAL_ROWS.person} open={Boolean(details.ownerName)}>
            <PersonSection {...props} />
          </OptionalRow>
          <OptionalRow id="social" {...OPTIONAL_ROWS.social} open={Object.values(details.social).some(Boolean)}>
            <SocialSection {...props} />
          </OptionalRow>
          <OptionalRow id="promise" {...OPTIONAL_ROWS.promise} open={Boolean(details.promiseNote)}>
            <PromiseSection {...props} />
          </OptionalRow>
        </section>

        <ShopPrivatePart {...contact} />
        <SaveBar changed={bar.changed} saving={bar.saving} slow={bar.slow} onSave={() => void bar.saveAll()} onDiscard={bar.discardAll} />
      </div>

      <aside className="hidden lg:sticky lg:top-6 lg:col-span-2 lg:block">
        <ShopPreview details={{ ...details, ...draft }} />
      </aside>
    </div>
    </SaveBarProvider>
  );
}
