import type { MarketplaceChannel } from "../channel-connection.types";
import type { MarketplaceProvider } from "./marketplace-provider";
import { amazonProvider } from "./amazon/amazon.provider";
import { flipkartProvider } from "./flipkart/flipkart.provider";

const PROVIDERS: Readonly<Record<MarketplaceChannel, MarketplaceProvider>> = {
  amazon: amazonProvider,
  flipkart: flipkartProvider,
};

export const providerFor = (channel: MarketplaceChannel): MarketplaceProvider => PROVIDERS[channel];
