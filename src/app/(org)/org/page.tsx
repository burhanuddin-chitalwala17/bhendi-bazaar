import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/admin-auth";
import { orgMemberRepository } from "@server/catalog/org.member.repository";
import { PageHeader } from "@/components/shared/page-shell";
import { ORG_PICKER_COPY } from "@/components/org/org-copy";
import { ROUTES } from "@server/shared/routes";

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

  if (orgs.length === 1) redirect(ROUTES.org.home(orgs[0].id));

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      {orgs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8">
          <h1 className="text-2xl font-bold">{ORG_PICKER_COPY.noneTitle}</h1>
          <p className="mt-2 text-muted-foreground">{ORG_PICKER_COPY.noneBody}</p>
          <div className="mt-8 flex gap-3">
            <Link
              prefetch={false}
              href={ROUTES.org.new}
              className="rounded-lg bg-primary px-4 py-2 text-small font-medium text-primary-foreground hover:bg-primary/90"
            >
              {ORG_PICKER_COPY.open}
            </Link>
            <Link
              prefetch={false}
              href={ROUTES.home}
              className="text-small font-medium hover:bg-muted/60"
            >
              {ORG_PICKER_COPY.backToStore}
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <PageHeader title={ORG_PICKER_COPY.chooseTitle} description={ORG_PICKER_COPY.chooseBody} />

          <ul className="mt-8 flex flex-col gap-3">
            {orgs.map((org) => (
              <li key={org.id}>
                <Link
                  prefetch={false}
                  href={ROUTES.org.home(org.id)}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <Icon name="shop" size="lg" tone="primary" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {org.name}
                    </span>
                    <span className="text-small text-muted-foreground">
                      {org.role.toLowerCase()}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Link
            prefetch={false}
            href={ROUTES.org.new}
            className="mt-6 inline-block text-small text-primary hover:underline"
          >
            {ORG_PICKER_COPY.openAnother}
          </Link>
        </div>
      )}
    </div>
  );
}
