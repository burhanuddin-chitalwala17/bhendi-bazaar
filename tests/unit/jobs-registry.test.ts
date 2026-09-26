/**
 * A job body is untrusted input like a request body (Invariant 4, worker-foundation D2):
 * the registry parses every payload against its type's schema before a handler sees it,
 * and refuses a type nobody registered.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  registerJob,
  resolveJob,
  resetJobRegistry,
  registeredJobTypes,
  UnknownJobTypeError,
} from "@server/shared/jobs/jobs.registry";

describe("the job registry", () => {
  beforeEach(() => resetJobRegistry());

  const echo = () =>
    registerJob({
      type: "echo",
      schema: z.object({ text: z.string().min(1) }),
      handler: async () => {},
    });

  it("resolves a registered type and hands back the parsed payload", () => {
    const definition = echo();
    const resolved = resolveJob({ type: "echo", payload: { text: "hi" } });
    expect(resolved.definition).toBe(definition);
    expect(resolved.payload).toEqual({ text: "hi" });
  });

  it("refuses a malformed payload before any handler runs", () => {
    echo();
    expect(() => resolveJob({ type: "echo", payload: { text: 42 } })).toThrow(z.ZodError);
    expect(() => resolveJob({ type: "echo", payload: {} })).toThrow(z.ZodError);
  });

  it("refuses an unknown type and a body that is not an envelope", () => {
    echo();
    expect(() => resolveJob({ type: "nope", payload: {} })).toThrow(UnknownJobTypeError);
    expect(() => resolveJob(null)).toThrow(/envelope/);
    expect(() => resolveJob({ payload: {} })).toThrow(/envelope/);
  });

  it("refuses a type registered twice", () => {
    echo();
    expect(() => echo()).toThrow(/registered twice/);
    expect(registeredJobTypes()).toEqual(["echo"]);
  });
});
