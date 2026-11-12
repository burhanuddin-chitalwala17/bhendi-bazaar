import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Footer } from "@/components/layout/footer";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PlatformMark } from "@/components/ui/icons/platform-marks";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROUTES } from "@server/shared/routes";

import { BUSINESS_COPY as COPY, STORE_COMMISSION_PERCENT, SUBSCRIPTION_MONTHLY_PAISE } from "./business-copy";
import { FEATURE_MOCKUPS, LiveEverywhereCard, StoreMockup } from "./business-mockups";

const PRICE = formatCurrency(SUBSCRIPTION_MONTHLY_PAISE);

/**
 * What Bhendi Bazaar is, for a business deciding whether to use it: the problem, the one idea
 * (a product in, every channel out), what it does, why it is different, then the price.
 */
export function BusinessPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <Hero />
        <BeforeAfter />
        <Hub />
        <Features />
        <Strengths />
        <Pricing />
        <Steps />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}

function Column({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-page px-gutter", className)}>{children}</div>;
}

function Label({ children, className }: { children: string; className?: string }) {
  return <p className={cn("text-label font-semibold uppercase text-primary", className)}>{children}</p>;
}

function SectionIntro({ label, title, lead, center }: { label: string; title: string; lead?: string; center?: boolean }) {
  return (
    <header className={cn("flex flex-col gap-3", center && "items-center text-center")}>
      <Label>{label}</Label>
      <h2 className="max-w-3xl font-heading text-display font-bold">{title}</h2>
      {lead && <p className="max-w-2xl text-body text-muted-foreground">{lead}</p>}
    </header>
  );
}

function OpenShop({ label, className }: { label: string; className?: string }) {
  return (
    <Button asChild size="lg" className={cn("rounded-full", className)}>
      <Link href={ROUTES.org.new} prefetch={false}>
        {label}
        <Icon name="forward" />
      </Link>
    </Button>
  );
}

function Hero() {
  return (
    <section className="border-b border-border bg-card">
      <Column className="flex items-center justify-between py-4">
        <Link href={ROUTES.home} prefetch={false} className="inline-flex">
          <BrandLogo size="md" priority />
        </Link>
        {/* Someone weighing the plan can ask before opening a shop (feature-access Q30). */}
        <div className="flex items-center gap-2">
          <ContactLauncher variant="ghost" className="min-h-10 rounded-full px-3 text-small md:min-h-0 md:h-8">{COPY.nav.contact}</ContactLauncher>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={ROUTES.org.new} prefetch={false}>
              {COPY.nav.cta}
            </Link>
          </Button>
        </div>
      </Column>

      <Column className="grid items-center gap-12 pb-section pt-8 md:pt-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-caption text-muted-foreground">
            <Icon name="shop" size="xs" tone="primary" />
            {COPY.hero.label}
          </span>
          <h1 className="font-heading text-landing font-bold text-foreground">{COPY.hero.title}</h1>
          <p className="max-w-xl text-body text-muted-foreground md:text-title md:font-normal">{COPY.hero.lead}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <OpenShop label={COPY.hero.primary} className="w-full sm:w-auto" />
            <Button asChild size="lg" variant="outline" className="w-full rounded-full sm:w-auto">
              <a href="#how">{COPY.hero.secondary}</a>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-muted-foreground">
            <span>
              <strong className="font-heading text-title font-bold text-foreground">{PRICE}</strong> {COPY.hero.perMonth}
            </span>
            {COPY.hero.proof.map((item) => (
              <span key={item} className="inline-flex items-center gap-1">
                <Icon name="done" size="xs" tone="primary" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex justify-center pb-10 lg:justify-end lg:pr-16">
          <StoreMockup />
          <LiveEverywhereCard className="absolute bottom-0 left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0" />
        </div>
      </Column>
    </section>
  );
}

function BeforeAfter() {
  return (
    <section className="py-section">
      <Column className="space-y-10">
        <SectionIntro label={COPY.before.label} title={COPY.before.title} lead={COPY.before.lead} />
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <div className="hidden grid-cols-2 border-b border-border md:grid">
            <p className="px-6 py-3 text-small font-semibold text-muted-foreground">{COPY.before.today}</p>
            <p className="border-l border-border px-6 py-3 text-small font-semibold text-primary">{COPY.before.with}</p>
          </div>
          <ul className="divide-y divide-border">
            {COPY.before.rows.map((row) => (
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

function Hub() {
  const { product, channels, stockNote } = COPY.hub;
  return (
    <section id="how" className="scroll-mt-4 border-y border-border bg-card py-section">
      <Column className="space-y-12">
        <SectionIntro label={COPY.hub.label} title={COPY.hub.title} lead={COPY.hub.lead} center />

        <div className="grid items-center gap-6 lg:grid-cols-3">
          <div className="mx-auto w-full max-w-sm rounded-card border border-border bg-background p-5 shadow-lifted lg:mx-0">
            <div className="flex items-center gap-4">
              <span className="flex size-16 items-center justify-center rounded-card bg-primary/10 text-primary">
                <Icon name="rida" size="xl" />
              </span>
              <div>
                <p className="text-body font-semibold">{product.name}</p>
                <p className="text-small text-muted-foreground">
                  {product.price} · {product.stock}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon name="forward" size="md" className="rotate-90 lg:rotate-0" />
            </span>
            <p className="max-w-48 text-caption text-muted-foreground">{stockNote}</p>
          </div>

          <ul className="mx-auto grid w-full max-w-sm gap-2 lg:mx-0">
            {channels.map((channel) => (
              <li key={channel.name} className="flex items-center gap-3 rounded-card border border-border bg-background p-3">
                {channel.mark ? (
                  <PlatformMark name={channel.mark} size="md" />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-field bg-primary text-primary-foreground">
                    <Icon name="shop" size="md" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-small font-semibold">{channel.name}</p>
                  <p className="text-caption text-muted-foreground">{channel.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Column>
    </section>
  );
}

function Features() {
  return (
    <section className="py-section">
      <Column className="space-y-20 md:space-y-28">
        {COPY.features.map((feature, index) => {
          const Mockup = FEATURE_MOCKUPS[feature.id as keyof typeof FEATURE_MOCKUPS];
          return (
            <article key={feature.id} className="grid items-center gap-10 md:grid-cols-2 lg:gap-20">
              <div className={cn("flex flex-col gap-4", index % 2 === 1 && "md:order-last")}>
                <Label>{feature.label}</Label>
                <h3 className="font-heading text-display font-bold">{feature.title}</h3>
                <p className="text-body text-muted-foreground">{feature.body}</p>
                <ul className="space-y-3 pt-2">
                  {feature.points.map((point) => (
                    <li key={point} className="flex gap-3 text-body">
                      <Icon name="done" size="sm" tone="primary" className="mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center rounded-card bg-muted/60 px-6 py-10 md:py-14">
                <Mockup />
              </div>
            </article>
          );
        })}
      </Column>
    </section>
  );
}

function Strengths() {
  return (
    <section className="border-t border-border py-section">
      <Column className="space-y-10">
        <SectionIntro label={COPY.strengths.label} title={COPY.strengths.title} />
        <ul className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {COPY.strengths.items.map((item) => (
            <li key={item.title} className="space-y-2">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name={item.icon} size="md" />
              </span>
              <h3 className="pt-2 text-title font-semibold">{item.title}</h3>
              <p className="text-body text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </Column>
    </section>
  );
}

/** The one change of key on the page, so the price is what is remembered. */
function Pricing() {
  const p = COPY.pricing;
  return (
    <section id="pricing" className="bg-foreground py-section text-background">
      <Column className="flex flex-col items-center gap-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="text-label font-semibold uppercase text-background/60">{p.label}</p>
          <h2 className="font-heading text-display font-bold">{p.title}</h2>
          <p className="max-w-xl text-body text-background/70">{p.lead}</p>
        </header>

        <div className="grid w-full max-w-5xl overflow-hidden rounded-card border border-background/15 bg-background/5 md:grid-cols-5">
          <div className="flex flex-col gap-5 p-6 md:col-span-2 md:p-10">
            <p className="text-small font-semibold text-background/70">{p.planName}</p>
            <div>
              <p className="font-heading text-landing font-bold">{PRICE}</p>
              <p className="mt-1 text-small text-background/70">{p.perMonth}</p>
            </div>
            <p className="text-small text-background/85">{p.commission(STORE_COMMISSION_PERCENT)}</p>
            <OpenShop label={p.cta} className="w-full" />
            <ContactLauncher variant="inverse" className="h-10 w-full rounded-full">{p.contact}</ContactLauncher>
            <p className="text-caption text-background/60">{p.cancel}</p>
          </div>
          <div className="space-y-6 border-t border-background/15 p-6 md:col-span-3 md:border-l md:border-t-0 md:p-10">
            <p className="text-small font-semibold">{p.includesTitle}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {p.includes.map((item) => (
                <li key={item} className="flex gap-2.5 text-small text-background/85">
                  <Icon name="done" size="sm" tone="primary" className="mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-background/15 pt-5">
              <p className="text-small font-semibold">{p.soonTitle}</p>
              <ul className="flex flex-wrap gap-2">
                {p.soon.map((item) => (
                  <li key={item} className="rounded-full border border-dashed border-background/30 px-3 py-1 text-caption text-background/75">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Column>
    </section>
  );
}

function Steps() {
  return (
    <section className="py-section">
      <Column className="space-y-10">
        <SectionIntro label={COPY.steps.label} title={COPY.steps.title} center />
        <ol className="grid gap-4 md:grid-cols-3">
          {COPY.steps.items.map((step, index) => (
            <li key={step.title} className="space-y-3 rounded-card border border-border bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary font-heading text-body font-bold text-primary-foreground">
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

function Faq() {
  return (
    <section className="border-t border-border py-section">
      <Column className="grid gap-10 lg:grid-cols-3">
        <SectionIntro label={COPY.faq.label} title={COPY.faq.title} />
        <div className="divide-y divide-border rounded-card border border-border bg-card lg:col-span-2">
          {COPY.faq.items.map((item) => (
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

function Closing() {
  return (
    <section className="pb-section">
      <Column>
        <div className="flex flex-col items-center gap-5 rounded-card border border-border bg-card px-6 py-14 text-center md:py-20">
          <h2 className="font-heading text-display font-bold">{COPY.closing.title}</h2>
          <p className="text-body text-muted-foreground">{COPY.closing.lead}</p>
          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <OpenShop label={COPY.closing.cta} className="w-full sm:w-auto" />
            <ContactLauncher className="h-10 w-full rounded-full sm:w-auto">{COPY.closing.contact}</ContactLauncher>
          </div>
        </div>
      </Column>
    </section>
  );
}
