import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fillTemplate, pinLinks, setStatus } from "../../scripts/spec.mjs";

const ROOT = resolve(__dirname, "../..");

describe("spec:new / spec:status", () => {
  it("fills a template and points ADR links at the right depth", () => {
    const t = "# Spec — <feature>\n- **Domain:** <x>\n- **Phase:** <y>\n- **Verified:** YYYY-MM-DD\n[a](../../adr/0015-x.md)";
    const top = fillTemplate(t, { feature: "gift-wrap", domain: "checkout", phase: "1", date: "2026-11-24", depth: 1 });
    expect(top).toBe("# Spec — gift-wrap\n- **Domain:** checkout\n- **Phase:** 1\n- **Verified:** 2026-11-24\n[a](../../adr/0015-x.md)");
    const sub = fillTemplate(t, { feature: "variants", date: "2026-11-24", depth: 2 });
    expect(sub).toContain("[a](../../../adr/0015-x.md)");
  });

  it("sets only the Status line, and refuses a doc without one", () => {
    expect(setStatus("# S\n- **Status:** Draft\n- **Phase:** 1\nStatus: Draft", "Accepted")).toBe("# S\n- **Status:** Accepted\n- **Phase:** 1\nStatus: Draft");
    expect(() => setStatus("# S", "Accepted")).toThrow(/Status/);
  });

  it("pins links into deleted build docs and leaves every other link alone", () => {
    const dir = resolve(ROOT, "docs/specs/gift-wrap");
    const text = "see [the TRD](trd.md#approach), [spec](spec.md), [ux](./ux.md) and [web](https://x.test/trd.md)";
    const out = pinLinks(text, dir, ["docs/specs/gift-wrap/trd.md", "docs/specs/gift-wrap/ux.md"], "0123456789abcdef");
    expect(out).toBe("see the TRD (`01234567:docs/specs/gift-wrap/trd.md`), [spec](spec.md), ux (`01234567:docs/specs/gift-wrap/ux.md`) and [web](https://x.test/trd.md)");
  });
});
