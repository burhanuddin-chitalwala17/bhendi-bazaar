import { IMAGE_QUALITY } from "@server/catalog/media";
import type { ProposalMimeType } from "@server/content/enhancement.types";
import type { SegmentInput } from "@server/content/providers/segment";

/**
 * What a tool is given: the photograph's bytes and where they are stored. The same shape a
 * segmenter takes, because a tool that needs one hands its input straight on (trd D2, D3).
 */
export type ToolInput = SegmentInput;

/** What every tool hands back: the bytes to propose, what they are, and how big the picture is. */
export interface ToolResult {
  output: Buffer;
  mimeType: ProposalMimeType;
  width: number;
  height: number;
}

/** The same encoder setting as every stored photograph (ADR-0026), so a result weighs what its source does. */
export const WEBP_QUALITY = Math.round(IMAGE_QUALITY * 100);
