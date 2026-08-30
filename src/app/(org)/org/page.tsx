import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireSession } from "@/lib/admin-auth";
import { orgMemberRepository } from "@server/catalog/org.member.repository";

export const metadata = { robots: { index: false, follow: false } };

/**
 * The way in to the org portal when no org is named.
 *
 * One membership goes straight through — being asked to choose between one thing is not
 * a choice. Several show a chooser rather than picking the first, because guessing which
 * org someone meant is how they edit the wrong catalogue.
 */
export default async function OrgIndexPage() {
  const session = await requireSession();
  const orgs = await orgMemberRepository.listOrgsForUser(session.user.id);

  if (orgs.length === 1) redirect(`/org/${orgs[0].id}`);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      {orgs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8">
          <h1 className="text-2xl font-bold">You are not part of an organisation</h1>
          <p className="mt-2 text-muted-foreground">
            Selling on Bhendi Bazaar happens through an organisation. Ask an owner to add
            you to theirs, or create your own.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              prefetch={false}
              href="/org/new"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create an organisation
            </Link>
            <Link
              prefetch={false}
              href="/"
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted/60"
            >
              Back to Store
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold">Choose an organisation</h1>
          <p className="mt-2 text-muted-foreground">
            You act for more than one. Pick the one you want to work on.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {orgs.map((org) => (
              <li key={org.id}>
                <Link
                  prefetch={false}
                  href={`/org/${org.id}`}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <Building2 className="h-6 w-6 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{org.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {org.code} · {org.role.toLowerCase()}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Link
            prefetch={false}
            href="/org/new"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            + Create another organisation
          </Link>
        </div>
      )}
    </div>
  );
}
