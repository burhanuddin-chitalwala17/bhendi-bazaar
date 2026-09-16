import { ContactLink } from "@/components/support/contact-link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="tracking-wide">
          © {year} Bhendi Bazaar. Curated Islamic boutique wear and more.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          {/* The signed-out route to Contact us — the account menu carries the other. */}
          <ContactLink />
          <p className="text-2xs uppercase tracking-eyebrow-wide">
            Crafted with niyyah in Mumbai&apos;s old quarter.
          </p>
        </div>
      </div>
    </footer>
  );
}


