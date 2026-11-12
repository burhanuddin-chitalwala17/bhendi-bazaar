/**
 * The paid features, for a component that draws a lock (feature-access D2). Re-exported here so a
 * screen asks its own components folder, not the subscriptions domain, and keeps its domain reach.
 */
export { FEATURE, type Feature } from "@server/subscriptions/feature-access.types";
