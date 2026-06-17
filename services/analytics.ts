import * as Application from "expo-application";
import { Platform } from "react-native";

type AnalyticsEventName =
  | "screen_view"
  | "article_open"
  | "ad_impression"
  | "saved_story"
  | "shared_story";

type AnalyticsProperties = Record<string, string | number | boolean | null>;

const APP_VERSION = Application.nativeApplicationVersion ?? "development";
const BUILD_VERSION = Application.nativeBuildVersion ?? "development";

export function trackEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {}
) {
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

  console.log("Analytics event:", JSON.stringify(event, null, 2));
}

export function trackScreenView(screenName: string) {
  trackEvent("screen_view", {
    screenName,
  });
}

export function trackArticleOpen(postId: number, title: string) {
  trackEvent("article_open", {
    postId,
    title,
  });
}

export function trackAdImpression(placement: string, advertiser?: string) {
  trackEvent("ad_impression", {
    placement,
    advertiser: advertiser ?? null,
  });
}

export function trackSavedStory(postId: number, title: string) {
  trackEvent("saved_story", {
    postId,
    title,
  });
}

export function trackSharedStory(postId: number, title: string) {
  trackEvent("shared_story", {
    postId,
    title,
  });
}