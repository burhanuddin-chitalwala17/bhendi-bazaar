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

/** The team uploading a shop's product media: the asset is the shop's, signed by the team's route (product-form D12). */
export function teamUploadEndpoints(orgId: string): UploadEndpoints {
  return { token: `/api/admin/orgs/${orgId}/upload/token`, confirm: `/api/admin/orgs/${orgId}/upload/confirm` };
}

export const ADMIN_UPLOAD_ENDPOINTS: UploadEndpoints = {
  token: "/api/admin/upload/token",
  confirm: "/api/admin/upload/confirm",
};
