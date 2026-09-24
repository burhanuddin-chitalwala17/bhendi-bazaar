import type { ReactNode } from "react";

import { SectionHeader } from "@/components/shared/SectionHeader";

/**
 * The profile route's heading, shared by the signed-in and signed-out views.
 *
 * Was a client component whose only job was to mount `ProfileProvider`, which fetched
 * `/api/profile` on mount. The page reads the profile on the server now ([ADR-0034]), so the
 * provider is gone and this is what the layout is actually for.
 */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        overline="Profile"
        title="Your Bhendi Bazaar profile"
        description="Manage your account information and delivery addresses."
      />
      {children}
    </div>
  );
}
