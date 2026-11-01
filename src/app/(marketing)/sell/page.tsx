import type { Metadata } from "next";

import { SELL_COPY } from "@/components/org/sell/sell-copy";
import { SellPage } from "@/components/org/sell/sell-page";
import { appUrl } from "@server/shared/app-url";

export const metadata: Metadata = {
  title: SELL_COPY.meta.title,
  description: SELL_COPY.meta.description,
  alternates: { canonical: `${appUrl()}/sell` },
};

export default function SellRoute() {
  return <SellPage />;
}
