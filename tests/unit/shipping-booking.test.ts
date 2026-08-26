// D2 (shipping-fulfilment TRD): booking request construction is tested against a pure
// function, not the live Shiprocket API — never call the live courier API from a test.
import { describe, expect, it } from "vitest";
import { buildShiprocketOrderPayload } from "@server/shipping/providers/shiprocket/shiprocket.mapper";
import type { CreateShipmentRequest } from "@server/shipping/domain/shipping.types";
import { getShipmentTrackingEmailTemplate } from "@server/notifications/templates/shipmentTrackingEmail";

const request = (overrides: Partial<CreateShipmentRequest> = {}): CreateShipmentRequest => ({
  shipmentCode: "BB-1001-SH1",
  orderDate: new Date("2026-08-25T10:00:00Z"),
  pickupLocationName: "Primary pickup",
  courierCode: "1",
  paymentMethod: "prepaid",
  subTotalPaise: 360000,
  weightKg: 1,
  billing: {
    customerName: "Fatima Khan",
    address: "12 Marine Drive",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
    phone: "9876543210",
  },
  items: [{ name: "Abaya - Classic", sku: "ABY-001", units: 2, sellingPrice: 150000 }],
  ...overrides,
});

describe("buildShiprocketOrderPayload", () => {
  it("sends the shipment's own code as the order id — the idempotency key (D5)", () => {
    const payload = buildShiprocketOrderPayload(request({ shipmentCode: "BB-2002-SH1" }));
    expect(payload.order_id).toBe("BB-2002-SH1");
  });

  it("converts every money field from paise to rupees", () => {
    const payload = buildShiprocketOrderPayload(
      request({ subTotalPaise: 360000, items: [{ name: "Item", sku: "X", units: 1, sellingPrice: 150050 }] })
    );
    expect(payload.sub_total).toBe(3600);
    expect(payload.order_items[0].selling_price).toBe(1500.5);
  });

  it("splits the customer's full name into first/last for Shiprocket's separate fields", () => {
    const payload = buildShiprocketOrderPayload(
      request({ billing: { ...request().billing, customerName: "Fatima Khan Dharwala" } })
    );
    expect(payload.billing_customer_name).toBe("Fatima");
    expect(payload.billing_last_name).toBe("Khan Dharwala");
  });

  it("falls back to a placeholder email for a guest order with none, never blank", () => {
    const payload = buildShiprocketOrderPayload(request({ billing: { ...request().billing, email: undefined } }));
    expect(payload.billing_email).toBeTruthy();
  });

  it("maps our 'width' to Shiprocket's 'breadth'", () => {
    const payload = buildShiprocketOrderPayload(
      request({ dimensions: { length: 20, width: 15, height: 5 } })
    );
    expect(payload.length).toBe(20);
    expect(payload.breadth).toBe(15);
    expect(payload.height).toBe(5);
  });

  it("defaults dimensions when the shipment has none", () => {
    const payload = buildShiprocketOrderPayload(request({ dimensions: undefined }));
    expect(payload.length).toBeGreaterThan(0);
    expect(payload.breadth).toBeGreaterThan(0);
  });

  it("marks a COD request distinctly from the default prepaid", () => {
    expect(buildShiprocketOrderPayload(request()).payment_method).toBe("Prepaid");
    expect(buildShiprocketOrderPayload(request({ paymentMethod: "cod" })).payment_method).toBe("COD");
  });
});

describe("getShipmentTrackingEmailTemplate", () => {
  it("renders the tracking number and a working tracking link", () => {
    const html = getShipmentTrackingEmailTemplate({
      id: "order_1",
      code: "BB-1001",
      customerName: "Fatima Khan",
      shipments: [
        {
          trackingNumber: "AWB123456",
          trackingUrl: "https://shiprocket.co/tracking/AWB123456",
          courierName: "Delhivery Surface",
        },
      ],
    });

    expect(html).toContain("AWB123456");
    expect(html).toContain("https://shiprocket.co/tracking/AWB123456");
    expect(html).toContain("Delhivery Surface");
  });

  it("labels each parcel when an order has multiple shipments", () => {
    const html = getShipmentTrackingEmailTemplate({
      id: "order_1",
      code: "BB-1001",
      customerName: "Fatima Khan",
      shipments: [
        { trackingNumber: "AWB1", trackingUrl: "https://x/1", courierName: "A" },
        { trackingNumber: "AWB2", trackingUrl: "https://x/2", courierName: "B" },
      ],
    });

    expect(html).toContain("Parcel 1 of 2");
    expect(html).toContain("Parcel 2 of 2");
  });
});
