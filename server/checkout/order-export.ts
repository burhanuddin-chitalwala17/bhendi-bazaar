import type { AdminOrderExportRow } from "@server/checkout/admin.order.types";

/** The most rows one export writes; a larger view is refused and asked to narrow (design-system Q37). */
export const ORDER_EXPORT_CAP = 10_000;

const INDIA_OFFSET_MS = 330 * 60_000;

export const ORDER_EXPORT_COLUMNS = [
  "Order", "Placed (India time)", "Status", "Payment", "Buyer", "Email", "Phone", "City", "Pincode", "Items", "Total (₹)", "Shops",
] as const;

/**
 * One cell, safe to open in a spreadsheet. A buyer types their own name and address, so a value
 * starting `=`, `+`, `-`, `@`, tab or return would run as a formula: it is prefixed with `'` first
 * (OWASP CSV injection), then quoted when it holds a comma, quote or line break.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** "1234.50" from 123450 paise: integer division, never a float (Invariant 3). */
export function rupeesText(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "2026-11-05 14:30": sortable in a spreadsheet, and India has no daylight saving. */
export function indiaStamp(value: Date): string {
  return new Date(value.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

/** The whole file: a header, then one line per order, CRLF as RFC 4180 has it. */
export function ordersCsv(rows: readonly AdminOrderExportRow[]): string {
  const lines = [ORDER_EXPORT_COLUMNS.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.code, indiaStamp(r.createdAt), r.status, r.paymentStatus, r.buyerName, r.buyerEmail, r.phone, r.city,
        r.pincode, r.itemCount, rupeesText(r.grandTotal), r.shops.join("; "),
      ].map(csvCell).join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
