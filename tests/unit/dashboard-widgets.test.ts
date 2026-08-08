// The widget registry's invariants (dashboard-widgets R1–R3): every declaration
// carries an audience; a "both" widget states how it narrows for an org; the
// audience filter and the structural gate keep platform figures away from org
// contexts — fetched, not just rendered.
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_WIDGETS,
  widgetsFor,
  fetchWidget,
} from "@server/analytics/widgets";

describe("the widget registry", () => {
  it("has unique keys", () => {
    const keys = DASHBOARD_WIDGETS.map((widget) => widget.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every widget serving both audiences declares its org scoping (R2)", () => {
    for (const widget of DASHBOARD_WIDGETS.filter((w) => w.audience === "both")) {
      expect(widget.scope, `"${widget.key}" needs a scope`).toBeTruthy();
    }
  });

  it("an org never receives a platform-only widget (R1/R3)", () => {
    const orgKeys = widgetsFor("org").map((widget) => widget.key);
    for (const widget of DASHBOARD_WIDGETS.filter((w) => w.audience === "platform")) {
      expect(orgKeys).not.toContain(widget.key);
    }
    // and the platform sees everything not org-only
    expect(widgetsFor("platform").length).toBe(
      DASHBOARD_WIDGETS.filter((w) => w.audience !== "org").length
    );
  });

  it("the gate is structural: an org context on a platform widget throws, whatever a page does", async () => {
    const platformOnly = DASHBOARD_WIDGETS.find((w) => w.audience === "platform");
    expect(platformOnly).toBeDefined();
    await expect(
      fetchWidget(platformOnly!, { audience: "org", orgId: "org-1" })
    ).rejects.toThrow(/platform-only/);
  });
});
