import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

/** Carries only the request's id: the person's Meta id stays sealed on the row (meta-foundation D7). */
export const deletePersonPayload = z.object({ requestId: z.string() });
export type DeletePersonPayload = z.infer<typeof deletePersonPayload>;

export const deletePersonSpec: JobSpec<DeletePersonPayload> = {
  type: "channels.delete-person",
  schema: deletePersonPayload,
  retry: { limit: 10, delaySeconds: 60 },
};
