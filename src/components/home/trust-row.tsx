import { Icon, type IconName } from "@/components/ui/icon";

/** What every order gets. No cash on delivery is promised anywhere (design-system Q27). */
const PROMISES: Array<{ icon: IconName; label: string }> = [
  { icon: "secure", label: "Secure payment" },
  { icon: "returns", label: "7-day returns" },
  { icon: "delivery", label: "Ships across India" },
];

export function TrustRow() {
  return (
    // Ruled above and below, not boxed (StoreHome): a promise is a line of the page, not a card to tap.
    <ul aria-label="Shopping with us" className="grid grid-cols-3 gap-2 border-y border-border py-4 md:py-5">
      {PROMISES.map((promise) => (
        <li key={promise.label} className="flex flex-col items-center gap-1.5 text-center text-caption text-foreground md:flex-row md:justify-center md:gap-2 md:text-small">
          <Icon name={promise.icon} size="lg" />
          {promise.label}
        </li>
      ))}
    </ul>
  );
}
