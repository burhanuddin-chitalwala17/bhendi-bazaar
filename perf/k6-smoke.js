// Load smoke for the browse path (docs/GTM-READINESS.md B12): home → category → product → cart, the
// reads a launch spike hits. Reads only: it never places an order or touches a payment.
//
//   k6 run -e BASE_URL=https://dev.bhendi-bazaar.com -e PEAK_VUS=60 perf/k6-smoke.js
//
// PEAK_VUS is 3× the expected peak of concurrent shoppers. Run against the preview, not production,
// unless a sale is close and the owner has said so: every request is a billed database read.
import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const PEAK = Number(__ENV.PEAK_VUS || 30);
const CATEGORY = __ENV.CATEGORY_SLUG || "abayas";
const PRODUCT = __ENV.PRODUCT_SLUG || "light-blue-rida";

export const options = {
  stages: [
    { duration: "1m", target: Math.ceil(PEAK / 3) },
    { duration: "2m", target: PEAK },
    { duration: "2m", target: PEAK },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    // The GTM targets: TTFB well under the 2.5 s LCP budget on a phone.
    "http_req_duration{page:product}": ["p(95)<1500"],
    "http_req_duration{page:category}": ["p(95)<1500"],
    "http_req_duration{page:home}": ["p(95)<1500"],
  },
};

const get = (path, page) => {
  const res = http.get(`${BASE_URL}${path}`, { tags: { page } });
  check(res, { [`${page} answers 200`]: (r) => r.status === 200 });
  return res;
};

export default function () {
  group("browse", () => {
    get("/", "home");
    sleep(1 + Math.random() * 2);
    get(`/category/${CATEGORY}`, "category");
    sleep(1 + Math.random() * 2);
    get(`/product/${PRODUCT}`, "product");
    sleep(1 + Math.random() * 2);
    get("/cart", "cart");
    sleep(1);
  });
}
