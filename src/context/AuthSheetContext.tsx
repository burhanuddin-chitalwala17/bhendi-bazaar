"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { AuthSheet } from "@/components/auth/auth-sheet";
import type { AuthView, SwitchAuthView } from "@/components/auth/auth-view";
import {
  clearStoredIntent,
  runIntent,
  storeIntent,
  takeStoredIntent,
  type AuthIntent,
} from "@/lib/auth-intent";

export interface OpenAuthSheet {
  view?: AuthView;
  reason?: string;
  /** Finished once sign-in succeeds; discarded if the sheet is closed (D6, D8). */
  intent?: AuthIntent;
}

interface AuthSheetContextValue {
  open: (options?: OpenAuthSheet) => void;
}

const AuthSheetContext = createContext<AuthSheetContextValue | undefined>(undefined);

/**
 * The single auth sheet, mounted once for the app and opened from anywhere — the
 * chrome, a page body, checkout, or WishlistContext, which renders nothing of its own
 * (seamless-sign-in D2).
 */
export function AuthSheetProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthView>("signin");
  const [reason, setReason] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  const intentRef = useRef<AuthIntent | null>(null);

  const open = useCallback((options: OpenAuthSheet = {}) => {
    // A new request supersedes whatever an earlier, abandoned Google trip left behind.
    clearStoredIntent();
    intentRef.current = options.intent ?? null;
    setView(options.view ?? "signin");
    setReason(options.reason);
    setEmail(undefined);
    setIsOpen(true);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    if (!next) {
      // Closing abandons the action; nothing happens later (R11).
      intentRef.current = null;
      clearStoredIntent();
    }
    setIsOpen(next);
  }, []);

  const onSwitchView: SwitchAuthView = useCallback((next, detail) => {
    setEmail(detail?.email);
    setView(next);
  }, []);

  // next-auth has already refreshed the session store by now (D3); the intent runs
  // before the refresh so the server-read saved set already contains its product.
  const onSuccess = useCallback(async () => {
    const intent = intentRef.current;
    intentRef.current = null;
    setIsOpen(false);
    if (intent) await runIntent(intent);
    router.refresh();
  }, [router]);

  const onBeforeGoogle = useCallback(() => {
    if (intentRef.current) storeIntent(intentRef.current);
    else clearStoredIntent();
  }, []);

  // The Google round trip lands on a fresh page load (D7). Signed in: finish what was
  // stored. Signed out: the trip was cancelled, so what was stored must never fire.
  useEffect(() => {
    if (status === "unauthenticated") {
      clearStoredIntent();
      return;
    }
    if (status !== "authenticated") return;
    const intent = takeStoredIntent();
    if (intent) void runIntent(intent).then(() => router.refresh());
  }, [status, router]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <AuthSheetContext.Provider value={value}>
      {children}
      <AuthSheet
        open={isOpen}
        onOpenChange={onOpenChange}
        view={view}
        reason={reason}
        email={email}
        onSwitchView={onSwitchView}
        onSuccess={onSuccess}
        onBeforeGoogle={onBeforeGoogle}
      />
    </AuthSheetContext.Provider>
  );
}

export function useAuthSheet(): AuthSheetContextValue {
  const context = useContext(AuthSheetContext);
  if (context === undefined) {
    throw new Error("useAuthSheet must be used within an AuthSheetProvider");
  }
  return context;
}
