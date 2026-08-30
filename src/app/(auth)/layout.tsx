import type { ReactNode } from "react";

import { Navbar } from "@/components/layout/navbar/Navbar";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-xl border border-border/70 bg-card/80 p-6 shadow-raised backdrop-blur">
          {children}
        </div>
      </main>
    </div>
  );
}


