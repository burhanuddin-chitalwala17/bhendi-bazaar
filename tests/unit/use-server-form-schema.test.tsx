/**
 * `useServerForm` validates against the schema of the latest render, not the one it mounted with:
 * several forms build their schema from props (an offer's loss rule, a signed-in contact form).
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { z } from "zod";
import { useServerForm } from "@/hooks/core/useServerForm";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const schemaFor = (min: number) => z.object({ amount: z.number().min(min) });

describe("useServerForm's schema follows its props", () => {
  it("a schema changed after mount is the one the submit validates against", async () => {
    const submit = vi.fn(async () => null);
    const { result, rerender } = renderHook(({ min }) => useServerForm({ schema: schemaFor(min), submit, defaultValues: { amount: 5 } }), {
      initialProps: { min: 1 },
    });

    rerender({ min: 10 });
    await act(async () => {
      await result.current.onSubmit();
    });
    expect(submit).not.toHaveBeenCalled();

    rerender({ min: 1 });
    await act(async () => {
      await result.current.onSubmit();
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
