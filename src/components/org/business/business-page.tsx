import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Footer } from "@/components/layout/footer";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { PageTabs } from "@/components/shared/page-tabs";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PlatformMark } from "@/components/ui/icons/platform-marks";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROUTES } from "@server/shared/routes";

import {
  AUDIENCE,
  type Audience,
  BUSINESS_COPY as COPY,
  PARTNER_PACKAGES_FROM_PAISE,
  STORE_COMMISSION_PERCENT,
  SUBSCRIPTION_MONTHLY_PAISE,
} from "./business-copy";
import {
  BrandBanner,
  CampaignMockup,
  FEATURE_MOCKUPS,
  LiveEverywhereCard,
  NewOrderCard,
  SITE_SHOTS,
  SiteShot,
  StoreMockup,
} from "./business-mockups";

const PRICE = formatCurrency(SUBSCRIPTION_MONTHLY_PAISE);
const PARTNER_FROM = formatCurrency(PARTNER_PACKAGES_FROM_PAISE);
const S = COPY.shop;
const P = COPY.partner;

/**
 * One page, two audiences (owner, 2026-11-14): a shop deciding to sell with us, or a brand deciding
 * to partner with us. Each side has one ask, repeated; the switch is a link so each has its own URL.
 */
export function BusinessPage({ audience }: { audience: Audience }) {
  const partner = audience === AUDIENCE.PARTNER;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">{partner ? <PartnerSide /> : <ShopSide />}</main>
      <Footer />
    </div>
  );
}

/* ── Shared pieces ─────────────────────────────────────────────────────────────── */

function Column({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-gutter", className)}>{children}</div>;
}

/** The films' type: a heavy sans line, then the emphasis in italic serif. */
function Headline({ title, emphasis, as: Tag = "h2", className }: { title: string; emphasis: string; as?: "h1" | "h2"; className?: string }) {
  return (
    <Tag className={cn("font-sans font-extrabold tracking-tight", Tag === "h1" ? "text-landing" : "text-display", className)}>
      {title} <em className="block font-heading font-bold italic">{emphasis}</em>
    </Tag>
  );
}

function Label({ children, className }: { children: string; className?: string }) {
  return <p className={cn("text-label font-semibold uppercase text-primary", className)}>{children}</p>;
}

function SectionIntro({ label, title, emphasis, lead, center }: { label: string; title: string; emphasis: string; lead?: string; center?: boolean }) {
  return (
    <header className={cn("flex flex-col gap-4", center && "items-center text-center")}>
      <Label>{label}</Label>
      <Headline title={title} emphasis={emphasis} className="max-w-3xl" />
      {lead && <p className="max-w-2xl text-body text-muted-foreground md:text-title md:font-normal">{lead}</p>}
    </header>
  );
}

/** Ink sections: the dark theme's tokens, scoped to the section, so every child reads correctly. */
function Night({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("dark scroll-mt-4 bg-background py-section text-foreground", className)}>
      {children}
    </section>
  );
}

function OpenShop({ label, className }: { label: string; className?: string }) {
  return (
    <Button asChild size="lg" variant="spotlight" className={cn("h-12 rounded-full px-7", className)}>
      <Link href={ROUTES.org.new} prefetch={false}>
        {label}
        <Icon name="forward" />
      </Link>
    </Button>
  );
}

function BecomePartner({ label, className }: { label: string; className?: string }) {
  return (
    <ContactLauncher intent="partner" variant="spotlight" size="lg" className={cn("h-12 rounded-full px-7", className)}>
      {label}
      <Icon name="forward" />
    </ContactLauncher>
  );
}

function TopBar({ audience }: { audience: Audience }) {
  return (
    <Column className="flex flex-col items-center gap-5 pt-5 md:flex-row md:justify-between">
      <Link href={ROUTES.home} prefetch={false} className="inline-flex">
        <BrandLogo size="lg" tone="light" priority />
      </Link>
      <PageTabs
        variant="segmented"
        label={COPY.switchLabel}
        current={audience}
        tabs={[
          { key: AUDIENCE.SHOP, label: COPY.tabs.shop, href: ROUTES.business },
          { key: AUDIENCE.PARTNER, label: COPY.tabs.partner, href: ROUTES.businessPartner },
        ]}
      />
    </Column>
  );
}

function Steps({ label, title, emphasis, items }: { label: string; title: string; emphasis: string; items: readonly { title: string; body: string }[] }) {
  return (
    <section className="py-section">
      <Column className="space-y-10">
        <SectionIntro label={label} title={title} emphasis={emphasis} center />
        <ol className="grid gap-4 md:grid-cols-3">
          {items.map((step, index) => (
            <li key={step.title} className="space-y-3 rounded-card border border-border bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary font-sans text-body font-bold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="text-title font-semibold">{step.title}</h3>
              <p className="text-body text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Column>
    </section>
  );
}

function Faq({ label, title, items }: { label: string; title: string; items: readonly { q: string; a: string }[] }) {
  return (
    <section className="border-t border-border py-section">
      <Column className="grid gap-10 lg:grid-cols-3">
        <header className="flex flex-col gap-4">
          <Label>{label}</Label>
          <h2 className="font-sans text-display font-extrabold tracking-tight">{title}</h2>
        </header>
        <div className="divide-y divide-border rounded-card border border-border bg-card lg:col-span-2">
          {items.map((item) => (
            <details key={item.q} className="group px-5 md:px-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-body font-semibold">
                {item.q}
                <Icon name="expand" tone="muted" className="transition-transform duration-fast ease-standard group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-body text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </Column>
    </section>
  );
}

/* ── Sell with us ──────────────────────────────────────────────────────────────── */

function ShopSide() {
  return (
    <>
      <ShopHero />
      <Problem />
      <Everywhere />
      <Features />
      <ComingSoon />
      <Pricing />
      <Steps label={S.steps.label} title={S.steps.title} emphasis={S.steps.titleEmphasis} items={S.steps.items} />
      <Faq label={S.faq.label} title={S.faq.title} items={S.faq.items} />
      <ShopClosing />
    </>
  );
}

function ShopHero() {
  const h = S.hero;
  return (
    <Night className="overflow-hidden pt-0">
      <TopBar audience={AUDIENCE.SHOP} />
      <Column className="grid items-center gap-14 pt-12 md:pt-16 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col items-start gap-6 lg:col-span-7">
          <Label>{COPY.eyebrow}</Label>
          <Headline as="h1" title={h.title} emphasis={h.titleEmphasis} />
          <p className="max-w-xl text-body text-muted-foreground md:text-title md:font-normal">{h.lead}</p>
          <OpenShop label={h.cta} className="w-full sm:w-auto" />
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-muted-foreground">
            <span>
              <strong className="font-sans text-title font-extrabold text-foreground">{PRICE}</strong> {h.perMonth}
            </span>
            {h.facts.map((fact) => (
              <span key={fact} className="inline-flex items-center gap-1">
                <Icon name="done" size="xs" tone="primary" />
                {fact}
              </span>
            ))}
          </p>
        </div>
        <div className="relative flex justify-center rounded-card bg-gradient-to-br from-primary/30 via-muted to-accent/20 px-4 pb-20 pt-10 lg:col-span-5">
          <StoreMockup className="lg:w-80" />
          <NewOrderCard className="absolute -top-5 right-4 hidden md:block" />
          <LiveEverywhereCard className="absolute -bottom-6 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0" />
        </div>
      </Column>
    </Night>
  );
}

function Problem() {
  const p = S.problem;
  return (
    <section className="py-section">
      <Column className="space-y-10">
        <SectionIntro label={p.label} title={p.title} emphasis={p.titleEmphasis} />
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-lifted">
          <div className="hidden grid-cols-2 border-b border-border bg-muted/60 md:grid">
            <p className="px-6 py-3 text-small font-semibold text-muted-foreground">{p.today}</p>
            <p className="border-l border-border px-6 py-3 text-small font-semibold text-primary">{p.with}</p>
          </div>
          <ul className="divide-y divide-border">
            {p.rows.map((row) => (
              <li key={row.today} className="grid md:grid-cols-2">
                <p className="flex gap-3 px-5 pt-5 text-body text-muted-foreground md:px-6 md:py-5">
                  <Icon name="close" size="sm" tone="muted" className="mt-0.5" />
                  {row.today}
                </p>
                <p className="flex gap-3 px-5 pb-5 pt-3 text-body font-medium text-foreground md:border-l md:border-border md:px-6 md:py-5">
                  <Icon name="done" size="sm" tone="primary" className="mt-0.5" />
                  {row.with}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Column>
    </section>
  );
}

function Everywhere() {
  const e = S.everywhere;
  return (
    <Night id="how">
      <Column className="space-y-12">
        <SectionIntro label={e.label} title={e.title} emphasis={e.titleEmphasis} lead={e.lead} center />
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="mx-auto w-full max-w-xs rounded-card border border-border bg-card p-4 shadow-overlay lg:col-span-4">
            <span className="flex aspect-video items-center justify-center rounded-card bg-gradient-to-br from-primary/30 to-primary/5 text-primary lg:aspect-square">
              <Icon name="rida" size="2xl" />
            </span>
            <p className="pt-4 text-body font-semibold">{e.product.name}</p>
            <p className="text-small text-muted-foreground">
              {e.product.price} · {e.product.stock}
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
            {e.places.map((place) => (
              <li
                key={place.name}
                className={cn(
                  "flex items-center gap-3 rounded-card border bg-card p-3",
                  place.status === "live" ? "border-border" : "border-dashed border-border/70",
                )}
              >
                {place.mark ? (
                  <PlatformMark name={place.mark} size="md" />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-field bg-primary text-primary-foreground">
                    <Icon name="shop" size="md" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-small font-semibold">{place.name}</p>
                  <p className="text-caption text-muted-foreground">{place.note}</p>
                </div>
                <StatusBadge tone={place.status === "live" ? "success" : "neutral"} dot={place.status === "live"}>
                  {place.status === "live" ? e.live : e.soon}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </div>
      </Column>
    </Night>
  );
}

function Features() {
  const f = S.features;
  return (
    <section className="py-section">
      <Column className="space-y-10">
        <SectionIntro label={f.label} title={f.title} emphasis={f.titleEmphasis} />
        <ul className="grid gap-5 md:grid-cols-2">
          {f.items.map((item) => {
            const Mockup = FEATURE_MOCKUPS[item.id];
            return (
              <li key={item.id} className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
                <div className="space-y-2 p-6 md:p-8">
                  <Label>{item.label}</Label>
                  <h3 className="font-sans text-headline font-extrabold tracking-tight">{item.title}</h3>
                  <p className="text-body text-muted-foreground">{item.body}</p>
                </div>
                <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary/10 via-muted/60 to-accent/30 px-6 py-10">
                  <Mockup />
                </div>
              </li>
            );
          })}
        </ul>
      </Column>
    </section>
  );
}

function ComingSoon() {
  const c = S.coming;
  return (
    <section className="border-y border-border bg-muted/40 py-section">
      <Column className="space-y-10">
        <SectionIntro label={c.label} title={c.title} emphasis={c.titleEmphasis} lead={c.lead} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.items.map((item) => (
            <li key={item.name} className="space-y-3 rounded-card border border-dashed border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <PlatformMark name={item.mark} size="lg" />
                <StatusBadge tone="neutral">{S.everywhere.soon}</StatusBadge>
              </div>
              <h3 className="text-title font-semibold">{item.name}</h3>
              <p className="text-body text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </Column>
    </section>
  );
}

function Pricing() {
  const p = S.pricing;
  return (
    <section id="pricing" className="bg-primary py-section text-primary-foreground">
      <Column className="grid items-center gap-10 lg:grid-cols-2">
        <header className="flex flex-col gap-4">
          <p className="text-label font-semibold uppercase text-primary-foreground/70">{p.label}</p>
          <Headline title={p.title} emphasis={p.titleEmphasis} />
          <p className="max-w-md text-body text-primary-foreground/80 md:text-title md:font-normal">{p.lead}</p>
        </header>
        <div className="rounded-card bg-background p-6 text-foreground shadow-overlay md:p-10">
          <p className="text-small font-semibold text-muted-foreground">{p.planName}</p>
          <p className="pt-3 font-sans text-landing font-extrabold tracking-tight">{PRICE}</p>
          <p className="text-small text-muted-foreground">{p.perMonth}</p>
          <p className="pt-4 text-small">{p.commission(STORE_COMMISSION_PERCENT)}</p>
          <ul className="grid gap-2.5 py-6 sm:grid-cols-2">
            {p.includes.map((item) => (
              <li key={item} className="flex gap-2 text-small">
                <Icon name="done" size="sm" tone="primary" className="mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <OpenShop label={S.hero.cta} className="w-full" />
          <p className="pt-3 text-center text-caption text-muted-foreground">{p.cancel}</p>
        </div>
      </Column>
    </section>
  );
}

function ShopClosing() {
  const c = S.closing;
  return (
    <Night>
      <Column className="flex flex-col items-center gap-6 text-center">
        <BrandLogo size="lg" tone="light" />
        <Headline title={c.title} emphasis={c.titleEmphasis} />
        <p className="text-body text-muted-foreground">{c.lead}</p>
        <OpenShop label={c.cta} className="w-full sm:w-auto" />
      </Column>
    </Night>
  );
}

/* ── Partner with us ───────────────────────────────────────────────────────────── */

function PartnerSide() {
  return (
    <>
      <PartnerHero />
      <Arrive />
      <Placements />
      <Values />
      <Steps label={P.steps.label} title={P.steps.title} emphasis={P.steps.titleEmphasis} items={P.steps.items} />
      <Faq label={P.faq.label} title={P.faq.title} items={P.faq.items} />
      <PartnerClosing />
    </>
  );
}

function PartnerHero() {
  const h = P.hero;
  return (
    <Night className="overflow-hidden pt-0">
      <TopBar audience={AUDIENCE.PARTNER} />
      <Column className="grid items-center gap-14 pt-12 md:pt-16 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col items-start gap-6 lg:col-span-7">
          <Label>{COPY.eyebrow}</Label>
          <Headline as="h1" title={h.title} emphasis={h.titleEmphasis} />
          <p className="max-w-xl text-body text-muted-foreground md:text-title md:font-normal">{h.lead}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <BecomePartner label={h.cta} className="w-full sm:w-auto" />
            <Button asChild size="lg" variant="outline" className="h-12 w-full rounded-full px-7 sm:w-auto">
              <a href="#placements">{h.secondary}</a>
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-muted-foreground">
            <span>
              {h.packagesFrom} <strong className="font-sans text-title font-extrabold text-foreground">{PARTNER_FROM}</strong>
            </span>
            {h.facts.map((fact) => (
              <span key={fact} className="inline-flex items-center gap-1">
                <Icon name="done" size="xs" tone="primary" />
                {fact}
              </span>
            ))}
          </p>
        </div>
        <div className="relative lg:col-span-5">
          <SiteShot src={SITE_SHOTS.home} alt={P.placements.home.alt} sizes="(min-width: 1024px) 560px, 100vw" priority>
            <BrandBanner label={h.brand} note={h.featured} className="absolute inset-x-[8%] top-[18%]" />
          </SiteShot>
        </div>
      </Column>
    </Night>
  );
}

function Arrive() {
  const a = P.arrive;
  return (
    <section className="py-section">
      <Column className="grid items-center gap-10 lg:grid-cols-2">
        <SectionIntro label={a.label} title={a.title} emphasis={a.titleEmphasis} lead={a.lead} />
        <div className="flex flex-col items-center gap-5 rounded-card border border-border bg-card p-6 md:p-10">
          <ul className="flex flex-wrap justify-center gap-4">
            {a.from.map((source) => (
              <li key={source.name} className="flex flex-col items-center gap-2 text-caption text-muted-foreground">
                <PlatformMark name={source.mark} size="lg" />
                {source.name}
              </li>
            ))}
          </ul>
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon name="forward" size="md" className="rotate-90" />
          </span>
          <p className="flex items-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-small font-semibold">
            <BrandLogo size="sm" />
            {a.landsOn}
          </p>
        </div>
      </Column>
    </section>
  );
}

function Placements() {
  const p = P.placements;
  const brand = P.hero.brand;
  return (
    <Night id="placements">
      <Column className="space-y-12">
        <SectionIntro label={p.label} title={p.title} emphasis={p.titleEmphasis} center />
        <ul className="grid gap-6 lg:grid-cols-3">
          <li className="space-y-4">
            <SiteShot src={SITE_SHOTS.home} alt={p.home.alt} sizes="(min-width: 1024px) 360px, 100vw">
              <BrandBanner label={brand} className="absolute inset-x-[10%] top-[22%]" />
            </SiteShot>
            <Placement index={1} title={p.home.title} body={p.home.body} />
          </li>
          <li className="space-y-4">
            <SiteShot src={SITE_SHOTS.category} alt={p.category.alt} sizes="(min-width: 1024px) 360px, 100vw">
              <BrandBanner label={brand} note={p.category.presents} className="absolute inset-x-[22%] top-[24%]" />
            </SiteShot>
            <Placement index={2} title={p.category.title} body={p.category.body} />
          </li>
          <li className="space-y-4">
            <CampaignMockup />
            <Placement index={3} title={p.campaign.title} body={p.campaign.body} />
          </li>
        </ul>
      </Column>
    </Night>
  );
}

function Placement({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <span className="font-heading text-title font-bold italic text-accent">{String(index).padStart(2, "0")}</span>
      <div className="space-y-1">
        <h3 className="text-title font-semibold">{title}</h3>
        <p className="text-body text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Values() {
  const v = P.values;
  return (
    <section className="py-section">
      <Column className="space-y-10">
        <SectionIntro label={v.label} title={v.title} emphasis={v.titleEmphasis} />
        <ul className="grid gap-4 md:grid-cols-3">
          {v.items.map((item) => (
            <li key={item.title} className="space-y-3 rounded-card border border-border bg-card p-6">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name={item.icon} size="md" />
              </span>
              <h3 className="text-title font-semibold">{item.title}</h3>
              <p className="text-body text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </Column>
    </section>
  );
}

function PartnerClosing() {
  const c = P.closing;
  return (
    <section className="bg-primary py-section text-primary-foreground">
      <Column className="flex flex-col items-center gap-6 text-center">
        <div aria-hidden className="flex items-center gap-4">
          <BrandLogo size="lg" tone="light" />
          <span className="font-heading text-headline italic text-primary-foreground/70">{c.times}</span>
          <span className="rounded-card border border-dashed border-primary-foreground/60 px-4 py-3 text-caption font-bold uppercase tracking-eyebrow">
            {c.brand}
          </span>
        </div>
        <Headline title={c.title} emphasis={c.titleEmphasis} />
        <p className="text-body text-primary-foreground/80">
          {c.lead} {P.hero.packagesFrom} <strong className="font-extrabold text-primary-foreground">{PARTNER_FROM}</strong>.
        </p>
        <BecomePartner label={c.cta} className="w-full sm:w-auto" />
      </Column>
    </section>
  );
}
