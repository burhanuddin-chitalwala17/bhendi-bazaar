// The error envelope every route returns and every client reads. A key mismatch here
// is invisible to the compiler — `createProduct` read `error.message` where the server
// sends `error`, so a duplicate-SKU failure surfaced as "Failed to create product".
// See CHANGELOG PR-20.
import { describe, expect, it, vi } from "vitest";
import { ApiError, readApiError, applyServerErrors } from "@/lib/api-error";

const jsonResponse = (body: unknown, status = 400) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("readApiError", () => {
  it("reads the `error` key the server actually sends", async () => {
    const e = await readApiError(jsonResponse({ error: "This SKU is already in use" }, 409));
    expect(e.message).toBe("This SKU is already in use");
    expect(e.status).toBe(409);
  });

  it("preserves field details", async () => {
    const e = await readApiError(
      jsonResponse({
        error: "This SKU is already in use",
        details: [{ path: "sku", message: "This SKU is already in use" }],
      }, 409)
    );
    expect(e.details).toEqual([{ path: "sku", message: "This SKU is already in use" }]);
  });

  it("accepts `message` too, since one legacy handler sends it", async () => {
    const e = await readApiError(jsonResponse({ message: "Legacy shape" }, 400));
    expect(e.message).toBe("Legacy shape");
  });

  it("falls back to a detail message when there is no summary", async () => {
    const e = await readApiError(
      jsonResponse({ details: [{ path: "sku", message: "Taken" }] }, 409)
    );
    expect(e.message).toBe("Taken");
  });

  it("survives a non-JSON body rather than throwing", async () => {
    const e = await readApiError(new Response("<html>502</html>", { status: 502 }));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(502);
    expect(e.details).toEqual([]);
  });

  it("never yields an empty message", async () => {
    const e = await readApiError(jsonResponse({}, 500));
    expect(e.message.length).toBeGreaterThan(0);
  });
});

describe("applyServerErrors", () => {
  it("routes a detail onto its form field", () => {
    const setError = vi.fn();
    const { applied, unapplied } = applyServerErrors(
      [{ path: "sku", message: "This SKU is already in use" }],
      setError
    );
    expect(setError).toHaveBeenCalledWith(
      "sku",
      { type: "server", message: "This SKU is already in use" },
      { shouldFocus: true }
    );
    expect(applied).toHaveLength(1);
    expect(unapplied).toHaveLength(0);
  });

  it("focuses only the first field", () => {
    const setError = vi.fn();
    applyServerErrors(
      [{ path: "sku", message: "a" }, { path: "name", message: "b" }],
      setError
    );
    expect(setError.mock.calls[0][2]).toEqual({ shouldFocus: true });
    expect(setError.mock.calls[1][2]).toEqual({ shouldFocus: false });
  });

  it("returns details it could not place, so nothing is silently dropped", () => {
    const setError = vi.fn();
    const { applied, unapplied } = applyServerErrors(
      [{ path: "notAFormField", message: "orphan" }],
      setError,
      ["sku", "name"]
    );
    expect(setError).not.toHaveBeenCalled();
    expect(applied).toHaveLength(0);
    expect(unapplied).toEqual([{ path: "notAFormField", message: "orphan" }]);
  });

  it("treats an empty path as unplaceable", () => {
    const setError = vi.fn();
    const { unapplied } = applyServerErrors([{ path: "", message: "general" }], setError);
    expect(setError).not.toHaveBeenCalled();
    expect(unapplied).toHaveLength(1);
  });
});
