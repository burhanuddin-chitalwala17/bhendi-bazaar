import { requireSession } from "@/lib/admin-auth";
import { CreateOrg } from "@/org/create-org";

export const metadata = {
  title: "Create an organisation",
  robots: { index: false, follow: false },
};

/**
 * Outside `/org/[orgId]`, so it is not behind the membership check — there is no org to
 * be a member of yet. Signed in is the only requirement.
 */
export default async function NewOrgPage() {
  await requireSession();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create an organisation</h1>
        <p className="mt-2 text-muted-foreground">
          Selling happens through an organisation. You will be its first owner.
        </p>
      </div>
      <CreateOrg />
    </div>
  );
}
