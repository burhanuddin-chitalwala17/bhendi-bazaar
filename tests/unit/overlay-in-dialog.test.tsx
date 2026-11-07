/**
 * A picker opened inside a dialog takes clicks. A modal dialog turns pointer events off for the page
 * and back on only for overlays registered in the same layer stack; when Radix's dismissable layer was
 * installed twice (dialog and popover each bundling their own), the brand form's country list drew but
 * ignored every click. `package.json` overrides pin one copy; this test fails if a second returns.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/** Every installed copy of a package, nested ones included. */
function copiesOf(pkg: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 6 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const next = join(dir, entry.name);
      if (next.endsWith(join("node_modules", pkg))) found.push(JSON.parse(readFileSync(join(next, "package.json"), "utf8")).version);
      if (entry.name === "node_modules" || entry.name.startsWith("@") || depth > 0) walk(next, depth + 1);
    }
  };
  walk(join(__dirname, "../../node_modules"), 0);
  return found;
}

function PickerInDialog({ onPick }: { onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Brand</DialogTitle>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button">Country</Button>
          </PopoverTrigger>
          <PopoverContent aria-label="Countries">
            <Button type="button" onClick={() => { onPick("IN"); setOpen(false); }}>India</Button>
          </PopoverContent>
        </Popover>
      </DialogContent>
    </Dialog>
  );
}

describe("a picker inside a dialog", () => {
  it("installs one copy of Radix's layer and focus pieces, so every overlay shares one stack", () => {
    expect(new Set(copiesOf(join("@radix-ui", "react-dismissable-layer"))).size).toBe(1);
    expect(new Set(copiesOf(join("@radix-ui", "react-focus-scope"))).size).toBe(1);
  });

  it("takes the click: the popover inside the dialog is not blocked by the dialog's pointer lock", () => {
    let picked: string | null = null;
    render(<PickerInDialog onPick={(v) => (picked = v)} />);
    fireEvent.click(screen.getByRole("button", { name: "Country" }));
    const option = screen.getByRole("button", { name: "India" });
    // The modal layer sets pointer-events none on the body; a registered child layer restores them.
    expect(getComputedStyle(option.closest("[data-slot=popover-content]")!).pointerEvents).not.toBe("none");
    fireEvent.click(option);
    expect(picked).toBe("IN");
  });
});
