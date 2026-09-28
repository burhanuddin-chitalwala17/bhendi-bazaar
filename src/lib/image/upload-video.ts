import { uploadDirect, type UploadDirectResult } from "@/lib/image/upload-direct";
import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { VIDEO_LIMITS, describeSizeLimit, isVideoContentType } from "@server/catalog/video";

/**
 * A user-attributable reason this file cannot be sent as a video, or null if it can
 * (video-hosting spec R2). Size is the one limit the browser can know before the bytes move;
 * duration is the worker's.
 */
export function videoFileProblem(file: { name: string; type: string; size: number }): string | null {
  if (!isVideoContentType(file.type)) {
    return `Not a video we can accept: ${file.name}. Allowed: MP4, MOV, WebM`;
  }
  if (file.size > VIDEO_LIMITS.maxUploadBytes) {
    return `Too large: ${file.name}. A video is ${describeSizeLimit()}`;
  }
  return null;
}

export interface UploadVideoOptions {
  endpoints: UploadEndpoints;
  pathFor: (file: File) => string;
}

/**
 * One video, browser to store, as it was picked (video-hosting trd D2, D3). Unlike a photograph
 * it is neither downscaled, cropped nor judged here: the worker transcodes it into the sizes a
 * buyer gets, so the bytes the browser holds are the source and go up untouched.
 */
export async function uploadVideo(file: File, options: UploadVideoOptions): Promise<UploadDirectResult> {
  const problem = videoFileProblem(file);
  if (problem) throw new Error(problem);
  return await uploadDirect(options.pathFor(file), file, options.endpoints);
}
