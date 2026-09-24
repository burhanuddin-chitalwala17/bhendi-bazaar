/**
 * The signed-in viewer's profile — a server component ([ADR-0034]).
 *
 * Was a client page reading everything through `ProfileContext`, which fetched `/api/profile`
 * on mount and held it in state. Both reads happen here; the editable sections are one leaf.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInButton } from "@/components/auth/sign-in-button";
import { ProfileSections } from "@/components/profile/profile-sections";
import { profileDAL } from "@/data-access-layer/profile.dal";
import { ordersDAL } from "@/data-access-layer/orders.dal";

export default async function ProfilePage() {
  const data = await profileDAL.mine();

  if (!data) {
    return (
      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle>Sign in to view your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-sm text-muted-foreground">
          <p>
            Your profile hosts your saved addresses and recent orders once you&apos;re signed
            in.
          </p>
          <SignInButton className="mt-1 h-10 rounded-full px-6 text-xs font-semibold uppercase tracking-eyebrow">
            Sign in
          </SignInButton>
        </CardContent>
      </Card>
    );
  }

  const orders = await ordersDAL.listForViewer();

  return <ProfileSections data={data} orders={orders} />;
}
