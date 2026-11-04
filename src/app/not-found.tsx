import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/states/EmptyState";

export default function NotFound() {
  return (
    <PageShell width="narrow" className="py-10">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        align="center"
        tone="gold"
        title="This page isn't here"
        description="It may have moved, or the piece may have sold out and been taken down."
        action={{ label: "Back to the bazaar", href: "/" }}
      />
    </PageShell>
  );
}
