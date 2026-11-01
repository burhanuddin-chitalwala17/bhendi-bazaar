/**
 * The portal sidebar stays put while the page scrolls. The bottom-anchored (shop) sidebar once
 * reset its edges with `md:inset-auto`, and `cn` (tailwind-merge) then dropped `md:top-0`: sticky
 * with no top does nothing, so the sidebar scrolled away. Nothing failed; the class just vanished.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortalSidebar } from "@/components/layout/PortalSidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/org/o1" }));

describe("the portal sidebar sticks from md", () => {
  it.each(["left", "bottom"] as const)("keeps md:sticky with md:top-0 when anchored %s", (anchor) => {
    render(<PortalSidebar header={null} items={[]} anchor={anchor} open={false} onOpenChange={() => {}} />);
    const classes = screen.getByRole("complementary", { hidden: true }).className.split(/\s+/);
    expect(classes).toContain("md:sticky");
    expect(classes).toContain("md:top-0");
  });
});
