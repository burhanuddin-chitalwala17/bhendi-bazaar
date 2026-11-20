import { getImageProps } from "next/image";

/** A picked file's own size, read in the page before anything is uploaded. */
export function readFileDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/** The loader's copy of a stored picture at this width: the smallest file that will do for a sample. */
export const optimizedUrl = (src: string, width: number) =>
  getImageProps({ src, alt: "", width, height: width }).props.src;

const SAMPLE_EDGE = 48;
const hex = (value: number) => Math.round(value).toString(16).padStart(2, "0");

/**
 * The average colour of a picture's outer edge (image-slots trd D5): what Fit it in fills the
 * margins with, so they read as the picture's own background. Null when it cannot be read.
 */
export function sampleEdgeColour(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_EDGE;
        canvas.height = SAMPLE_EDGE;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
        const { data } = context.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let y = 0; y < SAMPLE_EDGE; y++) {
          for (let x = 0; x < SAMPLE_EDGE; x++) {
            if (x > 1 && x < SAMPLE_EDGE - 2 && y > 1 && y < SAMPLE_EDGE - 2) continue;
            const i = (y * SAMPLE_EDGE + x) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
          }
        }
        resolve(`#${hex(r / n)}${hex(g / n)}${hex(b / n)}`);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    // The copy is on the bucket's domain now, not ours (ADR-0075): without CORS the canvas is tainted.
    image.crossOrigin = "anonymous";
    image.src = optimizedUrl(src, 64);
  });
}
