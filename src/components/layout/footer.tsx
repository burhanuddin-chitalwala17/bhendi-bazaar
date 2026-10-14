import Link from "next/link";

const POLICY_LINKS = [
  { href: "/policies#shipping", label: "Shipping" },
  { href: "/policies#returns", label: "Returns & refunds" },
  { href: "/policies#privacy", label: "Privacy" },
  { href: "/policies#terms", label: "Terms" },
  { href: "/policies#grievance", label: "Grievances" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="tracking-wide">
          © {year} Bhendi Bazaar. Curated Islamic boutique wear and more.
        </p>
        <nav aria-label="Store policies" className="flex flex-wrap gap-x-4 gap-y-2">
          {POLICY_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="underline-offset-4 hover:text-foreground hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-2xs uppercase tracking-eyebrow-wide">
          Crafted with niyyah in Mumbai&apos;s old quarter.
        </p>
      </div>
    </footer>
  );
}
