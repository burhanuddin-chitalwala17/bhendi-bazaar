/**
 * A picked sort shows at once. The control read its value from the URL, which changes only when
 * the new page arrives, so it snapped back to the old sort meanwhile and the pick looked ignored.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductSortSelect } from "@/components/shared/product-sort-select";

// A navigation that has not arrived: push is called, the URL keeps the old sort.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("the sort control", () => {
  it("keeps the picked sort while the sorted page loads, and asks for it", () => {
    render(<ProductSortSelect basePath="/store/shop" />);
    const select = screen.getByRole("combobox", { name: "Sort products" }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "price-asc" } });

    expect(select.value).toBe("price-asc");
    expect(push).toHaveBeenCalledWith("/store/shop?sort=price-asc");
  });
});
