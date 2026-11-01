/**
 * order-fulfilment U3 without a database: one timeline in India time on all three screens (A14,
 * R7), the booking form's rules (D11), the label allowlist (D7), and the emails booking sends (A3).
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@server/identity/account.service", () => ({ accountService: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const changeDates = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/components/order/pickups/pickupsApiClient", () => ({ pickupsApiClient: { changeDates: (...a: unknown[]) => changeDates(...(a as [])) } }));

import { toTimelineEntry, type ParcelTimelineDto } from "@server/checkout/parcel-timeline";
import { ParcelTimeline } from "@/components/order/timeline/parcel-timeline";
import { TIMELINE_READER, timelineLine } from "@/components/order/timeline/timeline-copy";
import { BOOKING_ERRORS, bookingSchema, pickupDateChangeSchema } from "@/lib/validation/schemas/booking.schema";
import { isLabelLink } from "@server/shipping/label";
import { renderParcelNotice } from "@server/notifications/templates/parcelNoticeEmail";
import { NOTICE_KIND, type ParcelNoticeData } from "@server/notifications/notice.types";
import { calendarDay, indiaToday } from "@server/shared/india-time";
import { BOOKING_COPY, DATE_COPY, parcelOf, pickupDue } from "@/components/order/pickups/pickups-copy";
import { PickupActions } from "@/components/order/pickups/pickup-actions";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";

const LABEL = "https://kr-shipmultichannel-mum.s3.ap-south-1.amazonaws.com/l.pdf";

describe("A14: a move at 23:30 UTC is the next day in India, on all three screens", () => {
  const entry = toTimelineEntry({
    kind: "move",
    fromStatus: "ready_for_pickup",
    toStatus: "pickup_booked",
    actor: "admin",
    reason: null,
    courierWording: null,
    pickupDate: new Date("2026-11-02T00:00:00Z"),
    estimatedDelivery: new Date("2026-11-06T00:00:00Z"),
    createdAt: new Date("2026-11-01T23:30:00Z"),
  });
  const timeline: ParcelTimelineDto = { courierName: "Delhivery", trackingNumber: "1234567890", entries: [entry] };

  it("the row's day and time are India's", () => {
    expect(entry.day).toBe("2 Nov");
    expect(entry.time).toBe("5:00 am");
    expect(entry.pickupDate).toBe("Mon 2 Nov");
  });

  it.each([TIMELINE_READER.SHOP, TIMELINE_READER.BUYER, TIMELINE_READER.ADMIN])("the %s screen shows 2 Nov", (reader) => {
    render(<ParcelTimeline timeline={timeline} reader={reader} />);
    expect(screen.getByText("2 Nov, 5:00 am")).toBeTruthy();
  });

  it("R7: one event, worded per reader as ux.md has it", () => {
    expect(timelineLine(TIMELINE_READER.SHOP, entry, timeline)).toBe("Pickup booked for Mon 2 Nov");
    expect(timelineLine(TIMELINE_READER.BUYER, entry, timeline)).toBe("Ships Mon 2 Nov · arrives by Fri 6 Nov");
    expect(timelineLine(TIMELINE_READER.ADMIN, entry, timeline)).toBe("Booked · Delhivery · 1234567890");
  });

  it("a calendar day is read as itself, never shifted by a zone", () => {
    expect(calendarDay(new Date("2026-11-02T00:00:00Z"))).toBe("Mon 2 Nov");
    expect(calendarDay("2026-11-02")).toBe("Mon 2 Nov");
  });
});

describe("D11: the booking form's rules (bookingSchema)", () => {
  const good = {
    pickupDate: "2026-11-02",
    estimatedDelivery: "2026-11-06",
    courierName: "Delhivery",
    trackingNumber: "1234567890",
    trackingUrl: "https://www.delhivery.com/track/1234567890",
    labelUrl: LABEL,
  };
  const errorsOf = (input: unknown) => {
    const parsed = bookingSchema.safeParse(input);
    return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  };

  it("accepts a whole booking", () => expect(errorsOf(good)).toEqual([]));
  it("names each missing field in ux.md's words", () => {
    expect(errorsOf({ ...good, pickupDate: "" })).toContain(BOOKING_ERRORS.pickupDate);
    expect(errorsOf({ ...good, trackingNumber: " " })).toContain(BOOKING_ERRORS.awb);
    expect(errorsOf({ ...good, trackingUrl: "http://x.test" })).toContain(BOOKING_ERRORS.trackingLink);
  });
  it("delivery must be after pickup, not the same day", () => {
    expect(errorsOf({ ...good, estimatedDelivery: "2026-11-02" })).toEqual([BOOKING_ERRORS.deliveryAfterPickup]);
  });
  it("a label link off Shiprocket's hosts is refused at booking", () => {
    expect(errorsOf({ ...good, labelUrl: "https://evil.test/label.pdf" })).toEqual([BOOKING_ERRORS.labelLink]);
  });
  it.each(["2026-02-30", "2026-13-01", "2026-00-10"])("%s is not a day: a field error, never a 500", (bad) => {
    expect(errorsOf({ ...good, pickupDate: bad })).toContain(BOOKING_ERRORS.pickupDate);
  });
  it("a changed pickup date can't be in the past", () => {
    const parsed = pickupDateChangeSchema.safeParse({ pickupDate: "2020-01-01", estimatedDelivery: "2020-01-05", seenPickupDate: indiaToday() });
    expect(parsed.success ? [] : parsed.error.issues.map((i) => i.message)).toContain(BOOKING_ERRORS.pickupPast);
  });
});

describe("D7: the label link allowlist", () => {
  it.each([
    [LABEL, true],
    ["https://app.shiprocket.in/label/1", true],
    ["http://kr-shipmultichannel-mum.s3.ap-south-1.amazonaws.com/l.pdf", false],
    ["https://shiprocket.in.evil.test/l.pdf", false],
    ["https://kr-shipmultichannel-mum.s3.ap-south-1.amazonaws.com@evil.test/l.pdf", false],
    ["https://user:pw@app.shiprocket.in/l.pdf", false],
    ["not a url", false],
  ])("%s → %s", (link, ok) => expect(isLabelLink(link)).toBe(ok));
});

describe("A3, R6: the emails booking and a date change send", () => {
  const data: ParcelNoticeData = {
    orderId: "o1",
    orderCode: "BB-4821",
    parcelCode: "BB-4821-SH1",
    orgId: "org1",
    shopName: "Zari Works",
    city: "Mumbai",
    since: new Date().toISOString(),
    courierName: "Delhivery",
    trackingNumber: "1234567890",
    trackingUrl: "https://www.delhivery.com/track/1234567890",
    pickupDate: "2026-11-02",
    estimatedDelivery: "2026-11-06",
  };

  it("the buyer hears the dates and the tracking link; never N/A", () => {
    const { subject, html } = renderParcelNotice(NOTICE_KIND.BOOKED_BUYER, data);
    expect(subject).toBe("Your order ships Mon 2 Nov");
    expect(html).toContain("Arrives by Fri 6 Nov. Track it with Delhivery:");
    expect(html).toContain(data.trackingUrl);
    expect(html).not.toContain("N/A");
  });

  it("the shop hears the date and is sent to the parcel page, not a label link (Q26)", () => {
    const { subject, html } = renderParcelNotice(NOTICE_KIND.BOOKED_SHOP, data);
    expect(subject).toBe("Pickup booked for Mon 2 Nov");
    expect(html).toContain("Delhivery will collect BB-4821-SH1. Open the parcel to download the label.");
    expect(html).toContain("/org/org1/orders/o1");
  });

  it("a date change: the shop the new pickup day, the buyer the new arrival day", () => {
    expect(renderParcelNotice(NOTICE_KIND.PICKUP_MOVED_SHOP, data).subject).toBe("Pickup moved to Mon 2 Nov");
    expect(renderParcelNotice(NOTICE_KIND.PICKUP_MOVED_BUYER, data).subject).toBe("New delivery date: Fri 6 Nov");
  });
});

describe("ux.md admin pickups copy", () => {
  it("names the parcel's place only in a multi-parcel order", () => {
    expect(parcelOf("BB-4821-SH2", 2)).toBe("Parcel 2 of 2");
    expect(parcelOf("BB-4821-SH1", 1)).toBeNull();
  });
  it("a passed pickup day is 'yesterday' first", () => expect(pickupDue(1)).toBe("Pickup was due yesterday"));
});

describe("D11: Change pickup date, twice from the same row", () => {
  const dayFromToday = (n: number) => new Date(Date.parse(`${indiaToday()}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const parcel = (pickupDate: string) => ({
    shipmentId: "s1",
    status: SHIPMENT_STATUS.PICKUP_BOOKED,
    courierName: "Delhivery",
    pickupDate,
    pickupDay: pickupDate,
    estimatedDelivery: dayFromToday(10),
  });
  async function changeTo(day: string) {
    fireEvent.click(screen.getByRole("button", { name: DATE_COPY.open }));
    fireEvent.change(await screen.findByLabelText(BOOKING_COPY.fields.pickupDate), { target: { value: day } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: DATE_COPY.save })));
  }

  it("the second change is compared against the date the first one set, not the one first rendered", async () => {
    const [d1, d2, d3] = [dayFromToday(1), dayFromToday(2), dayFromToday(3)];
    const view = render(<PickupActions parcel={parcel(d1)} />);
    await changeTo(d2);
    await waitFor(() => expect(changeDates).toHaveBeenLastCalledWith("s1", expect.objectContaining({ pickupDate: d2, seenPickupDate: d1 })));

    view.rerender(<PickupActions parcel={parcel(d2)} />); // what router.refresh() brings
    await changeTo(d3);
    await waitFor(() => expect(changeDates).toHaveBeenLastCalledWith("s1", expect.objectContaining({ pickupDate: d3, seenPickupDate: d2 })));
  });

  it("saving the dates as booked sends nothing", async () => {
    changeDates.mockClear();
    render(<PickupActions parcel={parcel(dayFromToday(1))} />);
    await changeTo(dayFromToday(1));
    expect(changeDates).not.toHaveBeenCalled();
  });
});
