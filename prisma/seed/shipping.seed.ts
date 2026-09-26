// Add this section after the SEED USERS section and before SEED CATEGORIES

import { SeedShippingProvider } from "./types";

export const seedShippingProviders: SeedShippingProvider[] = [
  {
    id: "shiprocket_001",
    code: "shiprocket",
    name: "Shiprocket",
    description: "India's leading shipping aggregator with 17+ courier partners including Blue Dart, Delhivery, DTDC, FedEx, and more. Offers best-in-class delivery rates and pan-India coverage.",
    priority: 1,
    connectionType: "email_password",
    paymentOptions: ["prepaid", "cod"],
    deliveryModes: ["air", "surface"],
    logoUrl: "https://shiprocket.in/wp-content/uploads/2021/07/shiprocket-logo-blue.svg",
    websiteUrl: "https://www.shiprocket.in"
  }
];

