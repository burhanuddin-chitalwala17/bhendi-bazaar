import { baseEmailStyles } from "./styles/baseEmailStyles";

/**
 * The one shell every transactional email renders into. A template supplies only what
 * differs — title, tagline, body — so a brand change is this file, not four files.
 */

/** Duplicated from `src/lib/config.ts` on purpose: `server/` must not import from `src/`. */
export const BRAND_NAME = "Bhendi Bazaar";
export const BRAND_TAGLINE = "Royal Curation of Islamic Clothing";

export interface EmailFooterLink {
  label: string;
  href: string;
}

export interface EmailFooter {
  heading?: string;
  note?: string;
  links?: EmailFooterLink[];
}

export interface EmailLayout {
  /** Document title, and what a preview pane shows. */
  title: string;
  /** Header line under the logo. */
  tagline?: string;
  /** Green confirmation strip between header and content. */
  banner?: string;
  /** Template-specific CSS, appended after the shared sheet. */
  styles?: string;
  /** The content block — compose it from the helpers below. */
  body: string;
  footer?: EmailFooter;
}

/**
 * Order names, addresses and notes reach these templates as typed-in text, so they are
 * escaped rather than trusted — an apostrophe or `<` in a name must not close a tag.
 */
export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail({
  title,
  tagline = BRAND_TAGLINE,
  banner,
  styles = "",
  body,
  footer = {},
}: EmailLayout): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${esc(title)} - ${BRAND_NAME}</title>
        <style>
          ${baseEmailStyles}
          ${styles}
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="accent-bar"></div>

          <div class="header">
            <h1 class="logo">${BRAND_NAME}</h1>
            <p class="tagline">${esc(tagline)}</p>
          </div>

          ${banner ? `<div class="success-banner">${banner}</div>` : ""}

          <div class="content">
            ${body}
          </div>

          ${renderFooter(footer)}

          <div class="accent-bar"></div>
        </div>
      </body>
    </html>
  `;
}

function renderFooter({
  heading = "Need Help?",
  note = "Our support team is here to assist you.",
  links = [],
}: EmailFooter): string {
  return `
          <div class="footer">
            <p style="font-weight: 600; color: #1a1a1a;">${esc(heading)}</p>
            <p>${esc(note)}</p>
            ${
              links.length > 0
                ? `
            <div class="social-links">
              ${links
                .map((link) => `<a href="${esc(link.href)}" class="social-link">${esc(link.label)}</a>`)
                .join(" • ")}
            </div>
            `
                : ""
            }
            <p class="copyright">
              &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
            </p>
          </div>`;
}

/* ---------- Content blocks ---------- */

export function greeting(text: string): string {
  return `<h2 class="greeting">${esc(text)}</h2>`;
}

/** `html` is markup, not user input — callers escape what they interpolate. */
export function paragraph(html: string, style = ""): string {
  return `<p class="message"${style ? ` style="${style}"` : ""}>${html}</p>`;
}

/** The muted closing line four templates each hand-rolled with the same inline style. */
export function closingNote(html: string, align: "left" | "center" = "left"): string {
  return paragraph(
    html,
    `margin-top: 30px; font-size: 14px; color: #666;${align === "center" ? " text-align: center;" : ""}`
  );
}

export function button(href: string, label: string): string {
  return `
            <div class="cta-container">
              <a href="${esc(href)}" class="button">${label}</a>
            </div>`;
}

/** The gold-bordered "this link expires" strip. */
export function noticeBox(html: string): string {
  return `
            <div class="expiry-notice">
              <p><span class="expiry-icon">⏰</span>${html}</p>
            </div>`;
}

/** Fallback for clients that strip the button. */
export function alternateLink(url: string): string {
  return `
            <hr class="divider">

            <div class="alternate-link">
              <p><strong>Can't click the button?</strong> Copy and paste this link into your browser:</p>
              <div class="link-text">${esc(url)}</div>
            </div>`;
}

export interface DetailRow {
  label: string;
  /** Pre-rendered markup — money and dates arrive already formatted. */
  value: string;
  /** Renders as the emphasised bottom line (a total or an amount). */
  final?: boolean;
}

export function detailPanel(rows: DetailRow[], variant: "bordered" | "plain" = "bordered"): string {
  const body = rows
    .map(
      (row) => `
              <div class="detail-row${row.final ? " final" : ""}">
                <span${row.final ? "" : ' class="detail-label"'}>${esc(row.label)}</span>
                <span${row.final ? "" : ' class="detail-value"'}>${row.value}</span>
              </div>`
    )
    .join("");

  return `
            <div class="panel${variant === "plain" ? " panel-plain" : ""}">${body}
            </div>`;
}
