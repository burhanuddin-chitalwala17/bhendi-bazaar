import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { NOT_FOUND_COPY } from "./app-copy";
import { ROUTES } from "@server/shared/routes";

export default function NotFound() {
  return (
    <PageShell width="narrow" className="py-10">
      <h1 className="sr-only">{NOT_FOUND_COPY.pageNotFound}</h1>
      <EmptyState
        align="center"
        tone="gold"
        title={NOT_FOUND_COPY.thisPageIsnTHere}
        description={NOT_FOUND_COPY.itMayHaveMovedOr}
        action={{ label: NOT_FOUND_COPY.backToBazaar, href: ROUTES.home }}
      />
    </PageShell>
  );
}
