
import { ANALYTICS_CONFIG } from "@/config/analytics";
import * as Application from "expo-application";
import { Platform } from "react-native";

type AnalyticsEventName =
  | "screen_view"
  | "article_open"
  | "ad_impression"
  | "saved_story"
  | "shared_story";

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null
>;

const APP_VERSION =
  Application.nativeApplicationVersion ?? "development";

const BUILD_VERSION =
  Application.nativeBuildVersion ?? "development";

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Send analytics events without blocking app navigation.
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {}
): void {
  if (!ANALYTICS_CONFIG.enabled) return;

  const { endpoint, apiKey } = ANALYTICS_CONFIG;

  if (
    !endpoint ||
    !apiKey ||
    apiKey === "PASTE_YOUR_PLUGIN_API_KEY_HERE"
  ) {
    if (__DEV__) {
      console.warn("YDL analytics is not configured");
    }
    return;
  }

  const event = {
    eventName,
    properties: {
      ...properties,
      platform: Platform.OS,
      appVersion: APP_VERSION,
      buildVersion: BUILD_VERSION,
      timestamp: new Date().toISOString(),
    },
  };

  void (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-ydl-app-key": apiKey,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (__DEV__) {
          console.warn(
            `YDL analytics HTTP ${response.status}: ${eventName}`
          );
        }
        return;
      }

      const result: { success?: boolean } =
        await response.json();

      if (result.success !== true && __DEV__) {
        console.warn(
          `YDL analytics event not accepted: ${eventName}`
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(
          `YDL analytics request failed: ${eventName}`,
          error
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  })();
}

export function trackScreenView(
  screenName: string
): void {
  trackEvent("screen_view", { screenName });
}

export function trackArticleOpen(
  postId: number,
  title: string
): void {
  trackEvent("article_open", { postId, title });
}

export function trackAdImpression(
  placement: string,
  advertiser?: string
): void {
  trackEvent("ad_impression", {
    placement,
    advertiser: advertiser ?? null,
  });
}

export function trackSavedStory(
  postId: number,
  title: string
): void {
  trackEvent("saved_story", { postId, title });
}

export function trackSharedStory(
  postId: number,
  title: string
): void {
  trackEvent("shared_story", { postId, title });
}
