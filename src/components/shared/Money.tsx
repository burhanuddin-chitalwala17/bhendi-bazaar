import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  /** Integer paise — the format the server sends and the only one this component accepts. */
  paise: number;
  /** Visual tone: muted for secondary figures, negative for losses/refunds. */
  tone?: "default" | "muted" | "negative";
  className?: string;
}

/**
 * An inline money amount for ledgers, summaries and tables — not a storefront price
 * (use `PriceDisplay` for that, which handles sale prices and offer badges).
 *
 * Tabular-nums so columns of numbers align, and the tone carries the meaning without
 * a colour the reader has to decode.
 */
export function Money({ paise, tone = "default", className }: MoneyProps) {
  return (
    <span
      className={cn(
        "tabular-nums",
        tone === "muted" && "text-muted-foreground",
        tone === "negative" && "text-destructive",
        className,
      )}
    >
      {formatCurrency(paise)}
    </span>
  );
}
