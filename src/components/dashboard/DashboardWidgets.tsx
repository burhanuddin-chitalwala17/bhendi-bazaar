import Link from "next/link";
import {
  Package,
  AlertTriangle,
  Truck,
  ShoppingCart,
  IndianRupee,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  widgetsFor,
  fetchWidget,
  type WidgetContext,
  type WidgetData,
  type WidgetDefinition,
} from "@server/analytics/widgets";

const ICONS = {
  package: Package,
  alert: AlertTriangle,
  truck: Truck,
  cart: ShoppingCart,
  rupee: IndianRupee,
  trend: TrendingUp,
  users: Users,
} as const;

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
                <p className="text-sm font-medium text-foreground">
                  {widget.title}
                </p>
                <p className="mt-1 text-sm text-destructive">
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
  const Icon = ICONS[widget.icon];
  const display =
    value.kind === "money" ? formatCurrency(value.value) : String(value.value);

  const body = (
    <Card
      className={
        widget.href ? "transition-colors hover:border-primary/40" : undefined
      }
    >
      <CardContent className="flex items-center gap-4 pt-5">
        <Icon className="h-8 w-8 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-2xl font-semibold">
            {display}
          </span>
          <span className="text-sm text-muted-foreground">
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
