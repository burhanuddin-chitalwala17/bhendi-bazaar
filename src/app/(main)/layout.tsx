import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar/Navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { EmailVerificationBanner } from "@/components/layout/EmailVerificationBanner";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <EmailVerificationBanner />
      <main className="flex-1">
        {/* px-3 on a phone: at 3-up, every 4px of gutter is 4px off each tile. */}
        <div className="mx-auto max-w-6xl px-3 py-4 pb-tabbar sm:px-6 sm:py-8 md:pb-8 lg:px-8">
          {children}
        </div>
      </main>
      {/* The tab bar is the phone's footer; the real one is desktop chrome. */}
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileTabBar />
    </div>
  );
}
