import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { channelsDAL } from "@/data-access-layer/channels.dal";
import { formatDate } from "@/lib/format";
import { DATA_DELETION_COPY, groupedCode } from "../data-deletion-copy";

const DONE_BY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export const metadata: Metadata = { title: DATA_DELETION_COPY.title, robots: { index: false, follow: false } };

/** Anyone with the code may read its state; it names nobody (meta-foundation R7). */
export default async function DataDeletionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.replaceAll("-", "").toUpperCase();
  const status = await channelsDAL.dataDeletion(code);

  return (
    <PageShell width="narrow">
      <PageHeader title={DATA_DELETION_COPY.title} />
      <section className="space-y-2 rounded-card border bg-card p-4 text-body md:p-6">
        {status === null ? (
          <p>{DATA_DELETION_COPY.unknown}</p>
        ) : (
          <>
            <p>{status.done ? DATA_DELETION_COPY.done : DATA_DELETION_COPY.inProgress(formatDate(status.doneBy, DONE_BY))}</p>
            <p className="text-small text-muted-foreground">{DATA_DELETION_COPY.reference(groupedCode(code))}</p>
          </>
        )}
      </section>
    </PageShell>
  );
}
