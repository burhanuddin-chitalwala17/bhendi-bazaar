// src/app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { useCartSync } from "@/hooks/cart/useCartSync";
import { useCartStore } from "@/store/cartStore";
import { Session } from "next-auth";
import { AuthSheetProvider } from "@/context/AuthSheetContext";
function CartSyncProvider({ children }: { children: React.ReactNode }) {
  // After mount, so the first client render matches the server's empty cart (cartStore skipHydration).
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);
  useCartSync(); // ← Initialize cart sync globally
  return <>{children}</>;
}

// ProfileProvider is intentionally NOT here — it fetches /api/profile on mount and is
// scoped to src/app/(main)/profile/layout.tsx. The chrome reads isEmailVerified from
// the session instead.
export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <CartSyncProvider>
        <Toaster position="top-right" richColors closeButton={true} />
        {/* Inside the session, so a sign-in here is seen by useCartSync's merge. */}
        <AuthSheetProvider>{children}</AuthSheetProvider>
      </CartSyncProvider>
    </SessionProvider>
  );
}
