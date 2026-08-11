import { DelayedSpinner } from "@/components/DelayedSpinner";

/**
 * Route-level loading state for everything under /app. The nav stays put;
 * the page area shows the (politely delayed) spinner while the destination
 * renders — which matters most on first visits to a title, where ingestion
 * can take seconds.
 */
export default function Loading() {
  return <DelayedSpinner />;
}
