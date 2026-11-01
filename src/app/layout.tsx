import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { FloatingAdminButton } from "@/components/layout/FloatingAdminButton";
import {
  APP_DESCRIPTION,
  APP_NAME,
  FAVICON,
  LOGO,
  OG_IMAGE,
  OG_IMAGE_SIZE,
} from "@/lib/config";
import { appUrl } from "@server/shared/app-url";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { redirect } from "next/navigation";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const headingFont = Playfair_Display({
  variable: "--font-heading-face",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = DM_Sans({
  variable: "--font-body-face",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  verification: {
    google: process.env.GOOGLE_VERIFICATION_TOKEN,
  },

  // Makes the root-relative brand paths below absolute, which is what a scraper needs —
  // without it Next resolves them against the deployment URL, not the custom domain.
  metadataBase: new URL(appUrl()),
  // Pages give their own name; the template adds the brand once, everywhere (B10).
  title: { default: APP_NAME, template: `%s — ${APP_NAME}` },
  description: APP_DESCRIPTION,
  icons: {
    // `type` says what the file is, not what we wish it were: these are the SVG, and
    // declaring it as PNG (as this did) is a claim a browser can act on and be wrong.
    // `sizes` describes the rendering hint, `type` the actual bytes — the logo is a
    // 500x500 PNG, so both 192 and 512 point at it and the browser downscales.
    icon: [
      { url: FAVICON, type: "image/png" },
      { url: LOGO["192"], sizes: "192x192", type: "image/png" },
      { url: LOGO["512"], sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{ ...OG_IMAGE_SIZE, url: OG_IMAGE, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// viewportFit: "cover" is what makes env(safe-area-inset-*) resolve to anything other
// than 0 — the bottom tab bar and the sticky product CTA both sit on the home
// indicator without it. No maximumScale/userScalable cap: pinch-zoom is an
// accessibility affordance, and the app feel comes from the layout, not from
// disabling the browser.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions); // ✨ Fetch on server

  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} antialiased`}
      >
        <Providers session={session}>
          {/* No Suspense here: one above every page streams a 200 before notFound() can
              set a 404 (Next's loading.md "Status codes"). Boundaries belong in pages. */}
          {children}
          <FloatingAdminButton />
          <SpeedInsights />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
