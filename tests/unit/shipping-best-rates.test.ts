// getBestRatesByDeliveryDays computed `availableRates` (blocked couriers filtered out)
// but then grouped over the original `rates` array, so a blocked courier could still
// win its delivery-day slot and be quoted to a buyer.
import { describe, expect, it } from "vitest";
import { ShippingOrchestratorService } from "@server/shipping/services/orchestrator.service";
import type { ShippingRate } from "@server/shipping/domain/shipping.types";

const rate = (overrides: Partial<ShippingRate> = {}): ShippingRate => ({
  providerId: "shiprocket",
  providerName: "Shiprocket",
  courierName: "Delhivery Surface",
  courierCode: "1",
  rate: 100,
  estimatedDays: 3,
  available: true,
  mode: "surface",
  ...overrides,
});

describe("getBestRatesByDeliveryDays", () => {
  const orchestrator = new ShippingOrchestratorService();

  it("excludes a blocked courier even when it is the cheapest for its delivery-day slot", () => {
    const blocked = rate({ courierCode: "blocked", rate: 10, available: false });
    const usable = rate({ courierCode: "usable", rate: 200, available: true });

    const winners = orchestrator.getBestRatesByDeliveryDays([blocked, usable]);

    expect(winners).toHaveLength(1);
    expect(winners[0].courierCode).toBe("usable");
  });

  it("still picks the cheapest among available couriers on the same day", () => {
    const cheap = rate({ courierCode: "cheap", rate: 100 });
    const expensive = rate({ courierCode: "expensive", rate: 150 });

    const winners = orchestrator.getBestRatesByDeliveryDays([expensive, cheap]);

    expect(winners).toHaveLength(1);
    expect(winners[0].courierCode).toBe("cheap");
  });

  it("returns nothing when every rate is blocked", () => {
    const winners = orchestrator.getBestRatesByDeliveryDays([
      rate({ available: false }),
      rate({ available: false, estimatedDays: 5 }),
    ]);

    expect(winners).toEqual([]);
  });
});
