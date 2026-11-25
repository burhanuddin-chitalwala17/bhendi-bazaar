/**
 * The morning email's pure rules (notification-hub/notifications-core unit 3, D4, Q10): when it runs, how
 * it reads, and that every reader of the badge registers the still-open checks first.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nextDigestRun } from "@server/notifications/digest.job";
import { renderMorningEmail } from "@server/notifications/templates/morningEmail";
import { notificationPrefsSchema } from "@/lib/validation/schemas/notifications.schema";

const ROOT = resolve(__dirname, "../..");

describe("the morning run is at 9 am IST (D4)", () => {
  it("before 9 am IST it is today's", () => {
    expect(nextDigestRun(new Date("2026-11-25T03:29:00Z"))).toEqual({ date: "2026-11-25", afterSeconds: 60 });
  });

  it("at or after 9 am IST it is tomorrow's", () => {
    expect(nextDigestRun(new Date("2026-11-25T03:30:00Z"))).toEqual({ date: "2026-11-26", afterSeconds: 86_400 });
    expect(nextDigestRun(new Date("2026-11-25T20:00:00Z")).date).toBe("2026-11-26");
  });
});

describe("the morning email (R4, ux journey 2)", () => {
  const view = {
    shop: "Niqab <Boutique>",
    lines: [
      { text: "2 messages waiting over 4 hours", count: 2, url: "https://x.test/org/o1" },
      { text: "1 post failed", count: 1, url: "https://x.test/org/o1" },
    ],
    settingsUrl: "https://x.test/org/o1/shop/details/notifications",
  };

  it("names how many things wait at which shop, one line and button per kind", () => {
    const { subject, html } = renderMorningEmail(view);
    expect(subject).toBe("3 things are waiting at Niqab <Boutique>");
    expect(html).toContain("2 messages waiting over 4 hours");
    expect(html.match(/class="button"/g)).toHaveLength(2);
    expect(html).toContain("You get this at 9 am when something is waiting. Turn it off in");
    expect(html).not.toContain("<Boutique>");
  });

  it("reads right for one thing", () => {
    expect(renderMorningEmail({ ...view, lines: [view.lines[1]] }).subject).toBe("1 thing is waiting at Niqab <Boutique>");
  });
});

describe("the switch takes only itself (Invariant 4)", () => {
  it("refuses another field", () => {
    expect(notificationPrefsSchema.safeParse({ morningEmail: false }).success).toBe(true);
    expect(notificationPrefsSchema.safeParse({ morningEmail: false, badge: false }).success).toBe(false);
    expect(notificationPrefsSchema.safeParse({ morningEmail: "no" }).success).toBe(false);
  });
});

describe("every reader of open items registers the still-open checks first (Q10)", () => {
  it.each([
    ["the bell route", "src/app/api/org/[orgId]/notifications/route.ts"],
    ["the morning job", "server/notifications/notifications.jobs.ts"],
  ])("%s", (_name, file) => {
    expect(readFileSync(resolve(ROOT, file), "utf8")).toMatch(/registerStillOpenChecks\(\);/);
  });
});
