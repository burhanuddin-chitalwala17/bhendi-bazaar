// src/app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { useCartSync } from "@/hooks/cart/useCartSync";
import { Session } from "next-auth";
function CartSyncProvider({ children }: { children: React.ReactNode }) {
  useCartSync(); // ← Initialize cart sync globally
  return <>{children}</>;
}

// ProfileProvider is intentionally NOT here — it fetches /api/profile on mount and is
// scoped to src/app/(main)/profile/layout.tsx. The chrome reads isEmailVerified from
// the session instead.
export function Providers({ children, session }: { children: React.ReactNode, session: Session | null }) {
  return (
    <SessionProvider session={session}>
      <CartSyncProvider>
        <Toaster position="top-right" richColors />
        {children}
      </CartSyncProvider>
    </SessionProvider>
  );
}
