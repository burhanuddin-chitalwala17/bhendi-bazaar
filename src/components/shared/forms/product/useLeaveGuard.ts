"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Where the person was going when the sheet stopped them; null is the back gesture. */
interface PendingLeave {
  href: string | null;
}

/**
 * "Leave without saving?" for every way off the form while it holds changes (product-form D10):
 * closing or reloading the tab, a link on our own site, and the back gesture. The back gesture
 * has nothing to cancel, so one history entry is pushed on the first change for it to pop.
 */
export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const activeRef = useRef(active);
  const armed = useRef(false);
  const leaving = useRef(false);
  const consuming = useRef(false);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      // Older browsers show the prompt only when this is set.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    // Capture phase, so the sheet opens before the router's own link handler navigates.
    const onClick = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({ href: `${url.pathname}${url.search}${url.hash}` });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);

  useEffect(() => {
    if (active && !armed.current) {
      window.history.pushState(window.history.state, "", window.location.href);
      armed.current = true;
    } else if (!active && armed.current && !leaving.current) {
      // Saved or undone: take back the pushed entry, or the next back lands on this same page.
      armed.current = false;
      consuming.current = true;
      window.history.back();
    }
  }, [active]);

  useEffect(() => {
    const onPop = () => {
      if (consuming.current) {
        consuming.current = false;
        return;
      }
      if (!armed.current || leaving.current) return;
      armed.current = false;
      if (activeRef.current) setPending({ href: null });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const stay = useCallback(() => {
    // The back gesture used up the pushed entry; push another so the next one is caught too.
    if (pending?.href === null && !armed.current) {
      window.history.pushState(window.history.state, "", window.location.href);
      armed.current = true;
    }
    setPending(null);
  }, [pending]);

  const leave = useCallback(() => {
    const target = pending;
    leaving.current = true;
    setPending(null);
    if (!target) return;
    if (target.href === null) window.history.back();
    else router.push(target.href);
  }, [pending, router]);

  return { pending: pending !== null, stay, leave };
}
