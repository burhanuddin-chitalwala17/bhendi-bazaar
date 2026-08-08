import { prisma } from "@server/shared/prisma";

/**
 * The dashboard, as declarations (dashboard-widgets R1–R4).
 *
 * One entry per widget: who it is for, how a `both` widget narrows for an org, and
 * the audience-gated query. The pages render whatever `widgetsFor` returns — adding
 * a widget is adding an entry here, and nothing else.
 *
 * Analytics is the documented read-only exception to no-cross-domain-reads
 * (CLAUDE.md), which is what a dashboard is; fetchers read Prisma directly.
 */

export type WidgetAudience = "platform" | "org" | "both";

export type WidgetContext =
  | { audience: "platform" }
  | { audience: "org"; orgId: string };

export interface WidgetData {
  /** "money" is integer paise — the UI formats (server/ must not import src/). */
  kind: "count" | "money";
  value: number;
  caption?: string;
}

export interface WidgetDefinition {
  key: string;
  title: string;
  /** Icon name resolved by the grid — a definition stays renderer-agnostic. */
  icon: "package" | "alert" | "truck" | "cart" | "rupee" | "trend" | "users";
  audience: WidgetAudience;
  /** Required exactly when audience is "both": how the org scope narrows the query (R2). */
  scope?: string;
  /** Where the number leads; ":orgId" is filled by the grid in the org portal. */
  href?: string;
  fetch: (ctx: WidgetContext) => Promise<WidgetData>;
}

const orgScope = (ctx: WidgetContext) => (ctx.audience === "org" ? { orgId: ctx.orgId } : {});

export const DASHBOARD_WIDGETS: WidgetDefinition[] = [
  {
    key: "products",
    title: "Products",
    icon: "package",
    audience: "both",
    scope: "Product.orgId",
    href: "/products",
    fetch: async (ctx) => ({
      kind: "count",
      value: await prisma.product.count({ where: orgScope(ctx) }),
    }),
  },
  {
    key: "low-stock",
    title: "Low stock",
    icon: "alert",
    audience: "both",
    scope: "Product.orgId",
    href: "/products",
    fetch: async (ctx) => {
      const products = await prisma.product.findMany({
        where: orgScope(ctx),
        select: { lowStockThreshold: true, stockLocations: { select: { quantity: true } } },
      });
      const low = products.filter((product) => {
        const total = product.stockLocations.reduce((sum, row) => sum + row.quantity, 0);
        return total > 0 && total <= product.lowStockThreshold;
      }).length;
      return { kind: "count", value: low, caption: "at or below threshold" };
    },
  },
  {
    key: "pending-parcels",
    title: "Parcels to send",
    icon: "truck",
    audience: "both",
    scope: "Shipment.orgId",
    href: "/orders",
    fetch: async (ctx) => ({
      kind: "count",
      value: await prisma.shipment.count({
        where: {
          ...orgScope(ctx),
          status: { in: ["pending", "processing"] },
          order: { paymentStatus: "paid" },
        },
      }),
      caption: "paid, not yet shipped",
    }),
  },
  {
    key: "orders",
    title: "Paid orders",
    icon: "cart",
    audience: "both",
    scope: "orders containing one of the org's shipments",
    href: "/orders",
    fetch: async (ctx) => ({
      kind: "count",
      value: await prisma.order.count({
        where: {
          paymentStatus: "paid",
          ...(ctx.audience === "org" ? { shipments: { some: { orgId: ctx.orgId } } } : {}),
        },
      }),
    }),
  },
  {
    key: "revenue",
    title: "Revenue",
    icon: "rupee",
    audience: "both",
    scope: "the org's parcels' item value on paid orders (ShipmentItem × unitPrice)",
    fetch: async (ctx) => {
      if (ctx.audience === "platform") {
        const paid = await prisma.order.aggregate({
          where: { paymentStatus: "paid" },
          _sum: { grandTotal: true },
        });
        return { kind: "money", value: paid._sum.grandTotal ?? 0, caption: "all paid orders" };
      }
      // The attribution order-and-cart-lines exists for: this org's parcel lines,
      // at the unit price actually paid. Shipping deliberately excluded (TRD D5).
      const lines = await prisma.shipmentItem.findMany({
        where: {
          shipment: { orgId: ctx.orgId, order: { paymentStatus: "paid" } },
        },
        select: { quantity: true, orderItem: { select: { unitPrice: true } } },
      });
      const value = lines.reduce((sum, line) => sum + line.quantity * line.orderItem.unitPrice, 0);
      return { kind: "money", value, caption: "items on paid orders" };
    },
  },
  {
    key: "customers",
    title: "Customers",
    icon: "users",
    audience: "platform",
    href: "/users",
    fetch: async () => ({
      kind: "count",
      value: await prisma.user.count({ where: { platformRole: "USER" } }),
      caption: "registered",
    }),
  },
  {
    key: "average-order",
    title: "Average order",
    icon: "trend",
    audience: "platform",
    fetch: async () => {
      const paid = await prisma.order.aggregate({
        where: { paymentStatus: "paid" },
        _sum: { grandTotal: true },
        _count: true,
      });
      const count = paid._count;
      return {
        kind: "money",
        value: count === 0 ? 0 : Math.round((paid._sum.grandTotal ?? 0) / count),
        caption: `across ${count} paid order${count === 1 ? "" : "s"}`,
      };
    },
  },
];

/** R1/R3: what an audience gets is a filter over declarations, not a page's opinion. */
export function widgetsFor(audience: "platform" | "org"): WidgetDefinition[] {
  return DASHBOARD_WIDGETS.filter(
    (widget) => widget.audience === "both" || widget.audience === audience
  );
}

/**
 * The structural gate (R3): an org context can never run a platform-only query,
 * whatever a page does. Thrown, not filtered — reaching here is a programming error.
 */
export async function fetchWidget(
  widget: WidgetDefinition,
  ctx: WidgetContext
): Promise<WidgetData> {
  if (ctx.audience === "org" && widget.audience === "platform") {
    throw new Error(`Widget "${widget.key}" is platform-only and was fetched with an org scope`);
  }
  return widget.fetch(ctx);
}
