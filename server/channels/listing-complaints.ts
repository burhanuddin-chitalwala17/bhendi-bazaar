import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { listingComplaintsSpec, type ListingComplaintsPayload } from "@server/shared/jobs/listing-complaints.job";

import type { ListingIssue } from "./platform-listing.types";

export type ListingComplaint = ListingComplaintsPayload["complaints"][number];
type Complaint = ListingComplaint;

/** Errors only, in the shape the requests job reads (setup-requests D5). */
export function complaintIssues(issues: readonly ListingIssue[]): Complaint["issues"] {
  return issues
    .filter((i) => i.severity === "error")
    .map((i) => ({ code: i.code, attribute: i.attribute ?? null, message: i.message, field: i.field, need: i.need ?? null }));
}

/**
 * Hand a marketplace's refusals to requests, one job per batch, in the caller's transaction when it
 * has one (setup-requests D5). Channels never imports requests; the job is the seam. Nothing raised
 * for a batch with no error.
 */
export async function handOverComplaints(complaints: readonly Complaint[], options: { standing?: boolean } = {}, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<void> {
  const withErrors = complaints.filter((c) => c.issues.length > 0);
  if (withErrors.length === 0) return;
  try {
    await enqueue(db, listingComplaintsSpec, { standing: options.standing ?? false, complaints: withErrors });
  } catch (error) {
    // A ticket is advice (ADR-0053): losing one never fails the send or the look that found it.
    console.error(`[channels] complaints hand-over failed: ${error instanceof Error ? error.name : "error"}`);
  }
}
