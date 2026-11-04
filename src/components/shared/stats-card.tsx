import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  /** What the number counts: "Revenue today". */
  title: string;
  value: string | number;
  description?: string;
  /** Change against the previous period, in percent. */
  trend?: { value: number; isPositive: boolean };
}

/** The number first, then what it is. No decorative icon: the figure is the thing to read. */
export function StatsCard({ title, value, description, trend }: StatsCardProps) {
  return (
    <Card className="gap-1 p-4">
      <p className="font-heading text-headline font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-small text-muted-foreground">{title}</p>
      {description && <p className="text-caption text-muted-foreground">{description}</p>}
      {trend && (
        <p className={cn("text-caption font-medium tabular-nums", trend.isPositive ? "text-success" : "text-destructive")}>
          <span className="sr-only">{trend.isPositive ? "Up" : "Down"} </span>
          <span aria-hidden>{trend.isPositive ? "↑" : "↓"} </span>
          {Math.abs(trend.value)}%
        </p>
      )}
    </Card>
  );
}
