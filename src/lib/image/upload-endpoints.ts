/**
 * The two routes a browser-direct upload talks to: the one that registers and signs, and the
 * one that confirms once the bytes have landed (media-library trd D2). Named here as literals
 * so every caller and the reachability guard see the same pair.
 */
export interface UploadEndpoints {
  token: string;
  /** Absent for a path that registers no asset — review photographs stay on their own table. */
  confirm?: string;
}

export function orgUploadEndpoints(orgId: string): UploadEndpoints {
  return { token: `/api/org/${orgId}/upload/token`, confirm: `/api/org/${orgId}/upload/confirm` };
}

export const ADMIN_UPLOAD_ENDPOINTS: UploadEndpoints = {
  token: "/api/admin/upload/token",
  confirm: "/api/admin/upload/confirm",
};
