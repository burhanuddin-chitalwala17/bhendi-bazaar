import { cache } from "react";

import { requestService } from "@server/requests/request.service";
import { NotFoundError } from "@server/shared/domain-error";
import type { AdminIssueDTO, AdminRequirementDTO, TicketType } from "@server/requests/request.types";

/** What the admin's Requests pages read, on the server (setup-requests ux "Requests inbox and detail"). */
export const adminRequestsDAL = {
  inbox: cache((type: TicketType, resolved: boolean, search: string | null, page: number) => requestService.inbox(type, { resolved, search, page })),
  counts: cache(() => requestService.counts()),
  /** A requirement or an issue; null only when neither exists. Any other failure reaches the error page. */
  async detail(id: string): Promise<{ requirement: AdminRequirementDTO } | { issue: AdminIssueDTO } | null> {
    try {
      return { requirement: await requestService.requirement(id) };
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
    try {
      return { issue: await requestService.issue(id) };
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  },
};
