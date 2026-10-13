/**
 * A label that names no control is decoration: a screen reader announces the input as
 * "edit text", a tap on the caption focuses nothing, and `getByLabelText` cannot find the
 * field. `FormField` rendered a bare `<label>` with no `htmlFor` and 102 `FormInput` /
 * `FormSelect` / `FormTextarea` sites inherited it, so the fix lives in the wrapper and
 * this is what keeps it there.
 *
 * Two halves. A render test on the wrapper — behaviour, not a markup snapshot: the `for`
 * resolves to the control, and `aria-describedby` resolves to the message actually shown.
 * And a source scan for raw `<label>` outside `ui/`: each either carries `htmlFor` or wraps
 * its control, which is the other association HTML provides and what the filter forms use.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
} from "@/components/shared/forms/FormField";
import { Input } from "@/components/ui/input";

const describedBy = (control: HTMLElement) => {
  const ids = control.getAttribute("aria-describedby");
  expect(ids, "the control names no description").not.toBeNull();
  return ids!.split(" ").map((id) => document.getElementById(id));
};

describe("FormField associates its label and messages with the control", () => {
  it("FormInput: the label's `for` is the input's id, and the error is announced for it", () => {
    render(<FormInput label="Name" error="Required" />);

    // Throws unless the label resolves to a control: that is the whole requirement.
    const input = screen.getByLabelText("Name");
    expect(input.id).not.toBe("");
    expect(screen.getByText("Name").getAttribute("for")).toBe(input.id);

    expect(input).toHaveAttribute("aria-invalid", "true");
    const [message] = describedBy(input);
    expect(message).toHaveTextContent("Required");
    expect(message).toHaveAttribute("role", "alert");
  });

  it("FormInput: with no error, the hint is what describes the input", () => {
    render(<FormInput label="SKU" hint="Letters and digits" />);

    const input = screen.getByLabelText("SKU");
    expect(input).toHaveAttribute("aria-invalid", "false");
    const [message] = describedBy(input);
    expect(message).toHaveTextContent("Letters and digits");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("FormInput: a caller-supplied id wins, and a caller's description is kept", () => {
    render(<FormInput id="given" label="Code" hint="Six digits" aria-describedby="elsewhere" />);

    const input = screen.getByLabelText("Code");
    expect(input.id).toBe("given");
    expect(input.getAttribute("aria-describedby")).toBe("elsewhere given-hint");
  });

  it("FormSelect and FormTextarea resolve the same way", () => {
    render(
      <>
        <FormSelect label="Style" error="Pick one">
          <option value="a">A</option>
        </FormSelect>
        <FormTextarea label="Notes" hint="Optional" />
      </>,
    );

    const select = screen.getByLabelText("Style");
    expect(select.tagName).toBe("SELECT");
    expect(describedBy(select)[0]).toHaveTextContent("Pick one");

    const textarea = screen.getByLabelText("Notes");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(describedBy(textarea)[0]).toHaveTextContent("Optional");
  });

  it("a bare FormField given an id points its label and messages at that id", () => {
    render(
      <FormField id="phone" label="Phone" error="Too short">
        <Input id="phone" aria-describedby="phone-error" />
      </FormField>,
    );

    const input = screen.getByLabelText("Phone");
    expect(input.id).toBe("phone");
    expect(describedBy(input)[0]).toHaveTextContent("Too short");
  });
});

// ── Source scan ───────────────────────────────────────────────────────────────

const ROOTS = ["src/components", "src/app"];
const PRIMITIVES = "src/components/ui";

/**
 * Files allowed to keep an unassociated raw `<label>`, each with the reason it survives.
 * Shrink-only: an entry whose file no longer has one must be removed. Empty today.
 */
const RATCHET: Record<string, string> = {};

/** A label that wraps one of these is associated by nesting, which HTML also allows. */
const CONTROL =
  /<(input|select|textarea|button|Input|Select|Textarea|Checkbox|Switch|PhoneInput)\b/;

function tsxFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(tsxFiles(path));
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const consumers = ROOTS.flatMap(tsxFiles).filter(
  (file) => !file.startsWith(`${PRIMITIVES}/`),
);

/** Line numbers of raw `<label>` openers that neither carry `htmlFor` nor wrap a control. */
function unassociatedLabels(source: string): { lines: number[]; seen: number } {
  const lines: number[] = [];
  let seen = 0;
  for (const match of source.matchAll(/<label\b/g)) {
    seen += 1;
    const openEnd = source.indexOf(">", match.index);
    const opening = source.slice(match.index, openEnd + 1);
    if (/\bhtmlFor\b/.test(opening)) continue;
    const close = source.indexOf("</label>", openEnd);
    const body = source.slice(openEnd + 1, close === -1 ? undefined : close);
    if (CONTROL.test(body)) continue;
    lines.push(source.slice(0, match.index).split("\n").length);
  }
  return { lines, seen };
}

describe("no raw <label> outside ui/ is left unassociated", () => {
  const scanned = consumers.map((file) => ({ file, ...unassociatedLabels(readFileSync(file, "utf8")) }));
  const labelsSeen = scanned.reduce((n, f) => n + f.seen, 0);

  it("the scan reaches the files it claims to check", () => {
    expect(consumers.length).toBeGreaterThan(100);
    // A floor on labels found, or a regex that matches nothing passes as a clean tree.
    expect(labelsSeen).toBeGreaterThanOrEqual(5);
  });

  it("every raw <label> carries htmlFor or wraps its control", () => {
    const offenders = scanned
      .filter((f) => f.lines.length && !(f.file in RATCHET))
      .flatMap((f) => f.lines.map((line) => `${f.file}:${line}`));
    expect(
      offenders,
      "A <label> that names no control labels nothing. Use `Label` with `htmlFor` and give the " +
        "control the id, or wrap the control in the label:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("the ratchet only shrinks", () => {
    for (const [file, reason] of Object.entries(RATCHET)) {
      expect(reason.length, `${file} needs a reason`).toBeGreaterThan(20);
      const entry = scanned.find((f) => f.file === file);
      expect(entry?.lines.length ?? 0, `${file} no longer has an unassociated label; remove it from RATCHET`).toBeGreaterThan(0);
    }
  });

  it("would catch a label that names nothing", () => {
    expect(unassociatedLabels('<label className="x">Name</label>').lines).toEqual([1]);
    expect(unassociatedLabels('<label htmlFor="a">Name</label>').lines).toEqual([]);
    expect(unassociatedLabels('<label\n  htmlFor="a"\n  className="x"\n>Name</label>').lines).toEqual([]);
    expect(unassociatedLabels('<label>Pick\n<input type="file" />\n</label>').lines).toEqual([]);
    expect(unassociatedLabels('<p/>\n<label>Kind<Select name="kind" /></label>\n<label>Loose</label>').lines).toEqual([3]);
  });
});
