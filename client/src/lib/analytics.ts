/**
 * Lightweight analytics helper.
 *
 * There is no third-party analytics SDK in this project yet, so events are
 * pushed to `window.dataLayer` (picked up automatically if Google Tag
 * Manager / GA is added later) and logged in dev for visibility.
 */
type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackEvent(event: string, props: AnalyticsProps = {}) {
  const payload = { event, ...props, timestamp: new Date().toISOString() };
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  }
  if (import.meta.env.DEV) {
    console.debug("[analytics]", event, props);
  }
}
