import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { FloatingAdminButton } from "@/components/layout/FloatingAdminButton";
import {
  APP_DESCRIPTION,
  APP_NAME,
  FAVICON,
  LOGO,
  OG_IMAGE,
  OG_IMAGE_SIZE,
} from "@/lib/config";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { redirect } from "next/navigation";

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
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: [
      { url: FAVICON },
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
          <Suspense fallback={<LoadingSkeleton />}>{children}</Suspense>
          <FloatingAdminButton />
        </Providers>
      </body>
    </html>
  );
}

