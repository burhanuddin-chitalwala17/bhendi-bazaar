/**
 * Export CSV on the admin orders list (design-system Q37), against a real schema. The failure
 * modes: a non-admin downloading every buyer's phone and address; a file holding a different set
 * from the screen; a buyer's name that runs as a spreadsheet formula; a total off by a paisa; an
 * export with no trail; and an unbounded file. Owns its world: its own orders and admin, removed after.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { isDisposableDb } from "../helpers/test-db";
import { DomainError } from "@server/shared/domain-error";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

const caller: { id: string | null } = { id: null };
vi.mock("@/lib/admin-auth", () => ({
  requirePlatformAdmin: async () => {
    if (!caller.id) throw new DomainError("Only the platform's admins can do that", { status: 403 });
    return { user: { id: caller.id } };
  },
}));

const cap = { value: 10_000 };
vi.mock("@server/checkout/order-export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@server/checkout/order-export")>()),
  get ORDER_EXPORT_CAP() {
    return cap.value;
  },
}));

describe.skipIf(!isDisposableDb)("orders export (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let GET: typeof import("@/app/api/admin/orders/export/route").GET;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const token = `EXP${stamp}`;
  let adminId: string;
  const orderIds: string[] = [];

  const order = async (o: { n: number; status: string; grandTotal: number; fullName: string }) => {
    const row = await prisma.order.create({
      data: {
        code: `${token}-${o.n}`,
        status: o.status,
        paymentStatus: PAYMENT_STATUS.PAID,
        grandTotal: o.grandTotal,
        address: { fullName: o.fullName, mobile: "+919820000000", city: "Surat", pincode: "395003", addressLine1: "1 Road", state: "Gujarat", country: "India" },
      },
      select: { id: true },
    });
    orderIds.push(row.id);
  };

  const exportCsv = (query: string) => GET(new NextRequest(`http://localhost/api/admin/orders/export?${query}`));

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ GET } = await import("@/app/api/admin/orders/export/route"));
    const admin = await prisma.user.create({ data: { email: `export-${stamp.toLowerCase()}@example.invalid`, name: "Export admin" } });
    adminId = admin.id;
    await order({ n: 1, status: ORDER_STATUS.CONFIRMED, grandTotal: 123_456, fullName: '=HYPERLINK("http://x.invalid","click")' });
    await order({ n: 2, status: ORDER_STATUS.DELIVERED, grandTotal: 99_901, fullName: "Sakina Rangwala" });
    // An abandoned checkout is not business: never exported (checkout-abandonment R4).
    await order({ n: 3, status: ORDER_STATUS.EXPIRED, grandTotal: 5_000, fullName: "Gone" });
  });

  afterAll(async () => {
    await prisma.adminLog.deleteMany({ where: { adminId } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { id: adminId } });
  });

  it("refuses anyone who is not a platform admin, and writes nothing", async () => {
    caller.id = null;
    const res = await exportCsv(`search=${token}`);
    expect(res.status).toBe(403);
    expect(await prisma.adminLog.count({ where: { adminId } })).toBe(0);
  });

  it("writes exactly the view on screen, total exact from paise, formulas defused, and leaves a trail", async () => {
    caller.id = adminId;
    const res = await exportCsv(`search=${token}&status=${ORDER_STATUS.CONFIRMED}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="bhendi-bazaar-orders-\d{4}-\d{2}-\d{2}\.csv"/);

    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`${token}-1`);
    expect(lines[1]).not.toContain(`${token}-2`);
    expect(lines[1]).toContain(",1234.56,");
    // Starts with a quote mark, so a spreadsheet shows it as text instead of running it.
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x.invalid"",""click"")"`);

    const trail = await prisma.adminLog.findFirst({ where: { adminId, action: "ORDERS_EXPORTED" } });
    expect(trail?.metadata).toMatchObject({ count: 1, view: { search: token, status: ORDER_STATUS.CONFIRMED } });
  });

  it("hides abandoned checkouts and refuses a view over the cap instead of cutting it short", async () => {
    caller.id = adminId;
    const all = (await (await exportCsv(`search=${token}`)).text()).trim().split("\r\n");
    expect(all).toHaveLength(3);
    expect(all.join("\n")).not.toContain(`${token}-3`);

    cap.value = 1;
    try {
      const res = await exportCsv(`search=${token}`);
      expect(res.status).toBe(422);
      expect(JSON.stringify(await res.json())).toMatch(/more than 1 orders/);
    } finally {
      cap.value = 10_000;
    }
  });
});
