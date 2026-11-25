"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { LibraryViewer as Viewer } from "@/components/org/library-viewer";

const LibraryViewer = dynamic(() => import("@/components/org/library-viewer").then((m) => m.LibraryViewer), {
  ssr: false,
});

type Props = Omit<ComponentProps<typeof Viewer>, "index"> & {
  /** Null while the viewer is closed, which is when the grid pays nothing for it (trd UI approach). */
  index: number | null;
};

/** The viewer, fetched and mounted only once something is opened in it. */
export function LazyLibraryViewer({ index, ...rest }: Props) {
  return index === null ? null : <LibraryViewer index={index} {...rest} />;
}
