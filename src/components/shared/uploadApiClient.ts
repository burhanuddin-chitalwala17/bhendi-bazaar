import { apiRequest } from "@/lib/api-client";

/**
 * Uploads that pass through our server, which normalises the image before storing it
 * (ADR-0026). A browser-direct upload is the presigned PUT in `src/lib/image/`, not this.
 */
export const uploadApiClient = {
  /** `endpoint` is the caller's: whose guard applies (admin or org member) is theirs to know. */
  async uploadFiles(
    endpoint: string,
    type: string,
    files: File[],
    extra: Record<string, string> = {},
  ): Promise<string[]> {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    Object.entries(extra).forEach(([name, value]) => body.append(name, value));
    const { urls } = await apiRequest<{ urls: string[] }>(`${endpoint}?type=${type}`, { method: "POST", body });
    return urls;
  },

  async uploadProfilePicture(file: File): Promise<string> {
    const body = new FormData();
    body.append("file", file);
    const { url } = await apiRequest<{ url: string }>("/api/profile/upload-picture", { method: "POST", body });
    return url;
  },
};
