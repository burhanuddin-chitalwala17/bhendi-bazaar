/**
 * A field made of parts is mapped part by part (listing-model/field-maps ux.md "A field in parts", Q23):
 * RUG's Item Dimensions L x W was mapped whole to a size word because the screen offered nothing else.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { FieldMapList } from "@/components/channel/field-map-list";
import type { AdminFieldMapDTO, AdminFieldMapsDTO, AdminFieldRowDTO } from "@server/listing/admin.field-map.types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const map = (fieldPath: string, extra: Partial<AdminFieldMapDTO> = {}): AdminFieldMapDTO => ({
  fieldPath, bbType: "", source: "attribute", key: "length", constant: null, unitTarget: "centimeters", reason: "The product's length",
  checkedSource: "test", checkedOn: "2026-11-20T00:00:00.000Z", values: {}, unpaired: [], allowed: [], waiting: false, wholeOnParts: false, ...extra,
});
const row = (extra: Partial<AdminFieldRowDTO>): AdminFieldRowDTO => ({
  field: "item_length_width", label: "Item Dimensions L x W", requirement: "required", adapterFills: false, addedOn: null, parts: ["length", "width"], maps: [], ...extra,
});
const view = (rows: AdminFieldRowDTO[]): AdminFieldMapsDTO => ({
  channel: "amazon", channelLabel: "Amazon", typeKey: "RUG", typeLabel: "RUG", readAt: null, rows,
  choices: { attributes: [{ key: "length", label: "length", planned: false }], rules: [], core: [], shop: [] },
});

describe("a field made of parts (field-maps Q23)", () => {
  it("names its parts, shows each mapped or not, and offers a Map for each missing part, never one for the whole field", () => {
    render(<FieldMapList view={view([row({ maps: [map("item_length_width.length")] })])} />);
    expect(screen.getByText("In parts: length, width")).toBeTruthy();
    expect(screen.getByText("Item Dimensions L x W · length")).toBeTruthy();
    expect(screen.getByText("Item Dimensions L x W · width")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Map width" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Map it" })).toBeNull();
  });

  it("opens the edit for a part on its own path", () => {
    render(<FieldMapList view={view([row({})])} />);
    fireEvent.click(screen.getByRole("button", { name: "Map length" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("marks a whole-field map on a field in parts as one that cannot fill it, with no Change of its own", () => {
    render(<FieldMapList view={view([row({ maps: [map("item_length_width", { source: "constant", key: null, constant: "Large", wholeOnParts: true })] })])} />);
    expect(screen.getByText("Can't fill a field in parts. Map each part instead.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.getByRole("button", { name: "Map length" })).toBeTruthy();
  });

  it("every map can be removed, a whole-field one on a field in parts included (field-maps Q24)", () => {
    render(<FieldMapList view={view([row({ maps: [map("item_length_width.length"), map("item_length_width", { source: "constant", key: null, constant: "Large", wholeOnParts: true })] })])} />);
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("a field with no parts keeps its one Map", () => {
    render(<FieldMapList view={view([row({ field: "department", label: "Department", parts: [] })])} />);
    expect(screen.getByRole("button", { name: "Map it" })).toBeTruthy();
    expect(screen.queryByText(/In parts/)).toBeNull();
  });
});
