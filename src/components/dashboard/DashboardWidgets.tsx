import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  widgetsFor,
  fetchWidget,
  type WidgetContext,
  type WidgetData,
  type WidgetDefinition,
} from "@server/analytics/widgets";

/** The registry's icon keys, by meaning (ADR-0066). */
const ICONS: Record<WidgetDefinition["icon"], IconName> = {
  package: "parcel",
  alert: "warning",
  truck: "delivery",
  cart: "bag",
  rupee: "rupee",
  trend: "trend",
  users: "team",
};

interface DashboardWidgetsProps {
  ctx: WidgetContext;
  /** Prefix for widget links — "/admin" or "/org/{id}". */
  basePath: string;
  /** The grid's columns; the org Home shows four from `lg:` (own-store onboarding ux.md). */
  gridClassName?: string;
  /** Figures the page already read, by widget key; those are not fetched again. */
  prefetched?: Record<string, WidgetData>;
}

/**
 * The one dashboard grid, for either portal (dashboard-widgets R1–R5). Widgets come
 * from the registry; each fetch runs server-side behind the audience gate, and a
 * widget whose data is unavailable fails alone (R5) — the rest of the grid renders.
 */
export async function DashboardWidgets({
  ctx,
  basePath,
  gridClassName = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  prefetched = {},
}: DashboardWidgetsProps) {
  const widgets = widgetsFor(ctx.audience);
  const results = await Promise.allSettled(
    widgets.map((widget) => prefetched[widget.key] ?? fetchWidget(widget, ctx)),
  );

  return (
    <div className={cn("grid gap-4", gridClassName)}>
      {widgets.map((widget, index) => {
        const result = results[index];
        if (result.status === "rejected") {
          console.error(
            `[DashboardWidgets] "${widget.key}" failed:`,
            result.reason,
          );
          return (
            <Card key={widget.key} className="border-destructive/30">
              <CardContent className="pt-5">
                <p className="text-small font-medium text-foreground">
                  {widget.title}
                </p>
                <p className="mt-1 text-small text-destructive">
                  Couldn’t load this figure
                </p>
              </CardContent>
            </Card>
          );
        }
        return (
          <WidgetCard
            key={widget.key}
            widget={widget}
            value={result.value}
            basePath={basePath}
          />
        );
      })}
    </div>
  );
}

function WidgetCard({
  widget,
  value,
  basePath,
}: {
  widget: WidgetDefinition;
  value: { kind: "count" | "money"; value: number; caption?: string };
  basePath: string;
}) {
  const display =
    value.kind === "money" ? formatCurrency(value.value) : String(value.value);

  const body = (
    <Card
      className={
        widget.href ? "transition-colors hover:border-primary/40" : undefined
      }
    >
      <CardContent className="flex items-center gap-4 pt-5">
        <Icon name={ICONS[widget.icon]} size="lg" tone="primary" />
        <span className="min-w-0">
          <span className="block truncate font-heading text-headline font-semibold tabular-nums">
            {display}
          </span>
          <span className="text-small text-muted-foreground">
            {widget.title}
            {value.caption ? ` — ${value.caption}` : ""}
          </span>
        </span>
      </CardContent>
    </Card>
  );

  return widget.href ? (
    <Link href={`${basePath}${widget.href}`} prefetch={false}>
      {body}
    </Link>
  ) : (
    body
  );
}
