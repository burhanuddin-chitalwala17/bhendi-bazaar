"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Select } from "@/components/ui/select";

/** Both filters are closed sets, so both are declared once and rendered from the declaration. */
const MIN_DAYS = [1, 2, 3, 7, 14, 30] as const;
/** Paise — the API compares these to a cart's computed value. */
const MIN_VALUE = [
  { paise: 0, label: "All Values" },
  { paise: 50_000, label: "₹500+" },
  { paise: 100_000, label: "₹1,000+" },
  { paise: 200_000, label: "₹2,000+" },
  { paise: 500_000, label: "₹5,000+" },
] as const;

/**
 * Abandoned-cart filters, held in the URL so the server can answer ([ADR-0034]).
 */
export function CartsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground/80">
          Minimum Days Abandoned
        </label>
        <Select
          value={params.get("minDays") ?? "1"}
          onChange={(e) => apply({ minDays: e.target.value })}
        >
          {MIN_DAYS.map((days) => (
            <option key={days} value={days}>{days}+ days</option>
          ))}
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground/80">
          Minimum Cart Value
        </label>
        <Select
          value={params.get("minValue") ?? "0"}
          onChange={(e) => apply({ minValue: e.target.value === "0" ? "" : e.target.value })}
        >
          {MIN_VALUE.map(({ paise, label }) => (
            <option key={paise} value={paise}>{label}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}
