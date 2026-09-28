/**
 * An overlay's surface follows its content ([ADR-0040](../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)).
 *
 * The bottom sheet was the right answer for a phone and became the answer for everything: a
 * country list, a date range, a crop canvas, a picker grid. On a laptop each of those opened a
 * 24rem panel against the right edge. The rule now is four cases — picker, canvas task, detail
 * panel, handed-off flow — and this file is what keeps a fifth from appearing by reflex.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const COMPONENTS = join(ROOT, "src/components");

/**
 * The files that may reach for `SheetContent` themselves, each with the decision it answers to.
 * An entry is a judgement recorded, not a suppression: adding one means saying which case it is.
 */
const MAY_USE_SHEET: Record<string, string> = {
  "src/components/ui/sheet.tsx": "Defines it.",
  "src/components/shared/overlays/responsive-picker.tsx":
    "Decision 1: the picker pair's phone half. A popover from `md`, this below it.",
  "src/components/org/media-library-grid.tsx":
    "Decision 3: the details of a selected item, beside a list that stays visible and whose selection moves.",
  "src/components/auth/auth-sheet.tsx":
    "Decision 4: a short flow the page hands off to. Signing in is a passage, not a place.",
  "src/components/support/contact-sheet.tsx":
    "Decision 4: the same, for writing to support.",
};

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(path);
  }
  return out;
}

const files = tsxFiles(COMPONENTS).map((path) => ({
  path: relative(ROOT, path),
  code: readFileSync(path, "utf8"),
}));

describe("an overlay's surface is chosen, not inherited", () => {
  it("only the declared files reach for a sheet themselves", () => {
    const offenders = files
      .filter((file) => /\bSheetContent\b/.test(file.code))
      .map((file) => file.path)
      .filter((path) => !(path in MAY_USE_SHEET));

    expect(
      offenders,
      "A sheet is one of four surfaces, not the default (ADR-0040). A value picked from a set is a " +
        "`ResponsivePicker`; a canvas — a crop, a comparison, a grid to choose from — is a " +
        "`TaskDialog`; the details of a selected item and a handed-off flow stay sheets and are " +
        "listed in MAY_USE_SHEET with the case they answer to:\n" +
        offenders.map((path) => `    ${path}`).join("\n"),
    ).toEqual([]);
  });

  it("keeps the list honest: an entry that no longer uses a sheet is removed", () => {
    const stale = Object.keys(MAY_USE_SHEET).filter(
      (path) =>
        !files.some(
          (file) => file.path === path && /\bSheetContent\b/.test(file.code),
        ),
    );

    expect(
      stale,
      `Allowlisted but no longer a sheet — drop the entry:\n${stale.map((p) => `    ${p}`).join("\n")}`,
    ).toEqual([]);
  });

  it("each surface pair carries its own phone form, so a component never chooses between screens", () => {
    const picker = files.find(
      (f) => f.path === "src/components/shared/overlays/responsive-picker.tsx",
    );
    const dialog = files.find(
      (f) => f.path === "src/components/shared/overlays/task-dialog.tsx",
    );

    expect(picker, "the picker pair is missing").toBeDefined();
    expect(dialog, "the canvas pair is missing").toBeDefined();
    // The picker switches root at the breakpoint; the dialog styles from the phone up.
    expect(picker?.code).toMatch(/useIsDesktop/);
    expect(picker?.code).toMatch(/PopoverContent/);
    expect(picker?.code).toMatch(/SheetContent/);
    expect(dialog?.code).toMatch(/h-dvh/);
    expect(dialog?.code).toMatch(/md:h-\[min\(/);
    // A canvas that scrolls is a canvas bigger than the screen, which is the one thing it must not be.
    expect(dialog?.code).toMatch(/overflow-hidden/);
  });

  it("a popover is reached through the primitive, never from the package", () => {
    const offenders = files
      .filter((file) => file.path !== "src/components/ui/popover.tsx")
      .filter((file) => /@radix-ui\/react-popover/.test(file.code))
      .map((file) => file.path);

    expect(
      offenders,
      `Import from "@/components/ui/popover" so the tokens apply (ADR-0031):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
