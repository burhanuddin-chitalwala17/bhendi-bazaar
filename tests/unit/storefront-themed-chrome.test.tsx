/**
 * A themed shop's own chrome (storefront-themes D7; R5, A5, Q6, own-store Q22, Q23). From any
 * themed page a buyer reaches the shop's home, its goods and deals, the marketplace's one cart,
 * their account and the whole marketplace in one tap; the footer carries the platform's mark,
 * contact and policies; and every product link keeps the shop (Q33).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/store/zaveri",
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/font/google", () => {
  const face = () => ({ variable: "face", className: "face", style: {} });
  return { Space_Grotesk: face, Geist_Mono: face, Jost: face, Cormorant_Garamond: face, DM_Mono: face, Mulish: face };
});
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/context/AuthSheetContext", () => ({ useAuthSheet: () => ({ open: vi.fn() }) }));
vi.mock("@/components/support/contact-launcher", () => ({
  ContactLauncher: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

import { ThemedShell } from "@/components/storefront/themed/chrome/themed-shell";
import { ThemedProductCard } from "@/components/storefront/themed/themed-product-card";
import { visitLabel } from "@/components/storefront/themed/section-heading";
import type { Product } from "@/domain/product";
import { CARD_STYLE } from "@server/catalog/storefront-themes";

const shell = (name = "Zaveri & Sons") =>
  render(
    <ThemedShell shop={{ handle: "zaveri", name, logoUrl: null, themeKey: "darbar", paletteKey: "emerald" }}>
      <p>page</p>
    </ThemedShell>,
  );

const hrefOf = (scope: HTMLElement, name: string) =>
  within(scope).getByRole("link", { name: new RegExp(`^${name}`) }).getAttribute("href");

describe("themed chrome (A5, Q6)", () => {
  it("scopes the theme and palette over the chrome and the page", () => {
    const { container } = shell();
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.theme).toBe("darbar");
    expect(root.dataset.palette).toBe("emerald");
  });

  it("tab bar: Home, Shop, Deals, the marketplace's cart, and More", () => {
    shell();
    const bar = screen.getByRole("navigation", { name: "Shop" });
    expect(hrefOf(bar, "Home")).toBe("/store/zaveri");
    expect(hrefOf(bar, "Shop")).toBe("/store/zaveri/shop");
    expect(hrefOf(bar, "Deals")).toBe("/store/zaveri/shop?deals=1");
    expect(hrefOf(bar, "Cart")).toBe("/cart");
    expect(within(bar).getByRole("button", { name: "More" })).toBeTruthy();
  });

  it("More reaches the account and the whole marketplace in one tap", async () => {
    shell();
    const more = screen.getByRole("button", { name: "More" });
    fireEvent.keyDown(more, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Login")).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Shop all of Bhendi Bazaar" }).getAttribute("href")).toBe("/");
  });

  it("header: the shop's name to its landing page and a search within the shop", () => {
    const { container } = shell();
    const header = container.querySelector("header") as HTMLElement;
    expect(hrefOf(header, "Zaveri & Sons")).toBe("/store/zaveri");
    expect(header.querySelector("form")?.getAttribute("action")).toBe("/store/zaveri/shop");
    expect(within(header).getByPlaceholderText("Search Zaveri & Sons")).toBeTruthy();
  });

  it("a long name: the header carries the logo alone, still named for a screen reader", () => {
    const long = "Zaveri & Sons Heritage Jewellers of Bhendi Bazaar";
    const { container } = shell(long);
    const header = container.querySelector("header") as HTMLElement;
    expect(within(header).queryByText(long)).toBeNull();
    expect(within(header).getByRole("link", { name: long }).getAttribute("href")).toBe("/store/zaveri");
  });

  it("footer: the shop's links, then the platform band with its mark, contact and policies (Q22)", () => {
    const { container } = shell();
    const footer = container.querySelector("footer") as HTMLElement;
    expect(hrefOf(footer, "Visit Zaveri & Sons")).toBe("/store/zaveri");
    const band = footer.querySelector("[data-platform-band]") as HTMLElement;
    expect(within(band).getByText("Sold on Bhendi Bazaar")).toBeTruthy();
    expect(within(band).getByRole("button", { name: "Contact us" })).toBeTruthy();
    expect(hrefOf(band, "Returns")).toBe("/policies#returns");
  });
});

describe("into a product and back (Q23, Q33)", () => {
  it('the landing page button reads "Visit {Shop name}", or "Visit shop" when the name is long', () => {
    expect(visitLabel("Zaveri & Sons")).toBe("Visit Zaveri & Sons");
    expect(visitLabel("Zaveri & Sons Heritage Jewellers")).toBe("Visit shop");
  });

  it("a product card keeps the shop; the product's canonical path is unchanged", () => {
    const product = { id: "1", slug: "zari-saree", name: "Zari saree", price: 120000, stock: 2, thumbnail: "/p.webp", categorySlug: "sarees", rating: 0, reviewsCount: 0 } as Product;
    render(<ThemedProductCard product={product} shopHandle="zaveri" cardStyle={CARD_STYLE.TALL} sizes="50vw" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/product/zari-saree?shop=zaveri");
  });
});
