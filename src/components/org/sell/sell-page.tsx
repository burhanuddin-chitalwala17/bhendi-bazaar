import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { APP_NAME, LOGO } from "@/lib/config";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

import { SELL_COPY as COPY, SUBSCRIPTION_MONTHLY_PAISE, type SellPillar } from "./sell-copy";

const OPEN_SHOP_HREF = "/org/new";
const PRICE = formatCurrency(SUBSCRIPTION_MONTHLY_PAISE);

/** The shop pricing pamphlet, full-bleed and outside the store chrome: one plan, the whole suite, one action. */
export function SellPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <Hero />
        <Suite />
        <Pricing />
        <Steps />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

/** The page's column inside a full-bleed band. */
function Column({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-page px-gutter", className)}>{children}</div>;
}

function Eyebrow({ children, className }: { children: string; className?: string }) {
  return (
    <p className={cn("text-2xs font-semibold uppercase tracking-eyebrow text-primary", className)}>
      {children}
    </p>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="max-w-3xl font-heading text-3xl font-bold tracking-tight md:text-5xl">{title}</h2>
    </header>
  );
}

function OpenShopButton({ label, className }: { label: string; className?: string }) {
  return (
    <Button asChild size="lg" className={cn("rounded-full", className)}>
      <Link href={OPEN_SHOP_HREF} prefetch={false}>
        {label}
        <Icon name="forward" />
      </Link>
    </Button>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-card to-background">
      {/* Soft halo behind the headline; semantic colours only, so it follows dark mode. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-96 -translate-x-1/2 rounded-full bg-accent/50 blur-3xl md:size-160"
      />

      <Column className="relative flex items-center justify-between py-4">
        <Link href="/" prefetch={false} aria-label={APP_NAME}>
          <Image src={LOGO.FULL} alt={APP_NAME} width={160} height={160} className="h-10 w-auto md:h-14" />
        </Link>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href={OPEN_SHOP_HREF} prefetch={false}>
            {COPY.hero.primary}
          </Link>
        </Button>
      </Column>

      <Column className="relative flex flex-col items-center gap-6 pb-section pt-10 text-center md:pt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-2xs font-semibold uppercase tracking-eyebrow text-muted-foreground shadow-raised">
          <Icon name="enhance" size="xs" tone="primary" />
          {COPY.hero.eyebrow}
        </span>

        <h1 className="font-heading text-5xl font-bold leading-none tracking-tight text-foreground md:text-7xl lg:text-8xl">
          {COPY.hero.title}
          <span className="block text-primary">{COPY.hero.titleAccent}</span>
        </h1>

        <p className="max-w-xl text-body text-muted-foreground md:text-xl">{COPY.hero.lead}</p>

        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-1">
            <span className="font-heading text-6xl font-bold tracking-tight text-foreground md:text-7xl">
              {PRICE}
            </span>
            <span className="text-lg text-muted-foreground">{COPY.hero.perMonth}</span>
          </div>
          <p className="mt-1 text-caption text-muted-foreground">{COPY.hero.taxNote}</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <OpenShopButton label={COPY.hero.primary} className="w-full sm:w-auto" />
          <Button asChild size="lg" variant="outline" className="w-full rounded-full sm:w-auto">
            <a href="#suite">{COPY.hero.secondary}</a>
          </Button>
        </div>
      </Column>
    </section>
  );
}

function Suite() {
  return (
    <section id="suite" className="scroll-mt-8 py-section">
      <Column className="space-y-10">
        <SectionTitle eyebrow={COPY.suite.eyebrow} title={COPY.suite.title} />

        <div className="grid gap-4 md:grid-cols-2">
          {COPY.pillars.map((pillar, index) => (
            <PillarCard key={pillar.eyebrow} pillar={pillar} featured={index === 0} />
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-2xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
            {COPY.soon.label}
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {COPY.soon.items.map((item) => (
              <li
                key={item}
                className="rounded-full border border-dashed border-border bg-card px-3 py-1.5 text-caption text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Column>
    </section>
  );
}

function PillarCard({ pillar, featured }: { pillar: SellPillar; featured: boolean }) {
  return (
    <article
      className={cn(
        "flex flex-col gap-5 rounded-card border p-6 transition-shadow hover:shadow-lifted md:p-10",
        featured
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-card-foreground",
      )}
    >
      <span
        className={cn(
          "inline-flex size-12 items-center justify-center rounded-full",
          featured ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
        )}
      >
        <Icon name={pillar.icon} size="md" />
      </span>
      <div className="space-y-2">
        <p
          className={cn(
            "text-2xs font-semibold uppercase tracking-eyebrow",
            featured ? "text-primary-foreground/75" : "text-primary",
          )}
        >
          {pillar.eyebrow}
        </p>
        <h3 className="font-heading text-2xl font-bold leading-tight tracking-tight md:text-3xl">{pillar.title}</h3>
      </div>
      <ul className="space-y-2.5">
        {pillar.points.map((point) => (
          <li key={point} className="flex gap-2.5 text-small md:text-body">
            <Icon name="done" tone={featured ? "current" : "primary"} className="mt-0.5" />
            <span className={featured ? "text-primary-foreground/90" : "text-muted-foreground"}>{point}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** A full-bleed dark band: the one moment the page changes key, so the price is the thing remembered. */
function Pricing() {
  return (
    <section id="pricing" className="bg-foreground py-section text-background">
      <Column className="flex flex-col items-center gap-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="text-2xs font-semibold uppercase tracking-eyebrow text-background/60">
            {COPY.pricing.eyebrow}
          </p>
          <h2 className="font-heading text-3xl font-bold tracking-tight md:text-5xl">{COPY.pricing.title}</h2>
        </header>

        <div className="w-full max-w-4xl overflow-hidden rounded-card border border-background/15 bg-background/5">
          <div className="grid md:grid-cols-5">
            <div className="flex flex-col gap-6 p-6 md:col-span-2 md:p-10">
              <p className="text-small font-semibold text-background/70">{COPY.pricing.planName}</p>
              <div>
                <p className="font-heading text-7xl font-bold tracking-tight">{PRICE}</p>
                <p className="mt-1 text-small text-background/70">{COPY.pricing.perMonth}</p>
              </div>
              <OpenShopButton label={COPY.pricing.cta} className="w-full" />
              <p className="text-caption text-background/60">{COPY.pricing.taxNote}</p>
            </div>
            <ul className="grid content-center gap-4 border-t border-background/15 p-6 sm:grid-cols-2 md:col-span-3 md:border-l md:border-t-0 md:p-10">
              {COPY.pricing.includes.map((item) => (
                <li key={item} className="flex gap-2.5 text-small">
                  <Icon name="done" tone="primary" className="mt-0.5" />
                  <span className="text-background/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Column>
    </section>
  );
}

function Steps() {
  return (
    <section className="py-section">
      <Column className="flex flex-col items-center gap-8">
        <Eyebrow>{COPY.steps.eyebrow}</Eyebrow>
        <ol className="grid w-full max-w-4xl gap-3 md:grid-cols-3">
          {COPY.steps.items.map((step, index) => (
            <li key={step.title} className="flex items-center gap-4 rounded-card border border-border bg-card p-5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-body font-bold text-primary-foreground">
                {index + 1}
              </span>
              <div>
                <p className="font-heading text-lg font-bold">{step.title}</p>
                <p className="text-small text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Column>
    </section>
  );
}

function Faq() {
  return (
    <section className="border-t border-border py-section">
      <Column className="flex flex-col items-center gap-8">
        <Eyebrow>{COPY.faq.eyebrow}</Eyebrow>
        <div className="w-full max-w-2xl divide-y divide-border rounded-card border border-border bg-card">
          {COPY.faq.items.map((item) => (
            <details key={item.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-small font-semibold md:text-body">
                {item.q}
                <Icon name="expand" tone="muted" className="transition-transform duration-fast ease-standard group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-small text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
        <OpenShopButton label={COPY.hero.primary} />
      </Column>
    </section>
  );
}
