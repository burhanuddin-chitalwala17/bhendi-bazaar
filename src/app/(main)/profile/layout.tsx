"use client";

import type { ReactNode } from "react";
import { ProfileProvider } from "@/context/ProfileContext";

// ProfileProvider fetches /api/profile on mount, so it is scoped to the one route
// that renders the full profile. It used to wrap the whole app (src/app/providers.tsx),
// which fetched the profile on every page load for every signed-in user — data no
// other page reads. The chrome's only need, isEmailVerified, now rides the session.
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <ProfileProvider>{children}</ProfileProvider>;
}
