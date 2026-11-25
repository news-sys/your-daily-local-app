import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";

import {
    getNotificationPreferences,
    type NotificationPreferences,
} from "@/services/notificationPreferences";
import { registerForPushNotificationsAsync } from "@/services/notifications/registerForPushNotifications";

const WORDPRESS_PUSH_REGISTER_URL =
  "https://yourdailylocal.com/wp-json/ydl-mobile/v1/push/register";

const DEVICE_ID_STORAGE_KEY = "ydl_mobile_device_id";
const FETCH_TIMEOUT_MS = 10000;

export type PushSyncResult = {
  expoPushToken: string | null;
  success: boolean;
  statusMessage: string;
  httpStatus?: number;
  responseText?: string;
};

function createDeviceId(): string {
  return `ydl-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getDeviceId(): Promise<string> {
  const existingDeviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const newDeviceId = createDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, newDeviceId);

  return newDeviceId;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getCurrentExpoPushToken(): Promise<string | null> {
  return registerForPushNotificationsAsync();
}

export async function syncPushRegistration(
  preferences?: NotificationPreferences,
  existingExpoPushToken?: string | null
): Promise<PushSyncResult> {
  const expoPushToken =
    existingExpoPushToken ?? (await getCurrentExpoPushToken());

  if (!expoPushToken) {
    return {
      expoPushToken: null,
      success: false,
      statusMessage: "No Expo push token available.",
    };
  }

  try {
    const deviceId = await getDeviceId();
    const notificationPreferences =
      preferences ?? (await getNotificationPreferences());

    const response = await fetchWithTimeout(WORDPRESS_PUSH_REGISTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        appKey: "ydl",
        expoPushToken,
        platform: Platform.OS,
        preferences: notificationPreferences,
        appVersion: Application.nativeApplicationVersion ?? "development",
        buildVersion: Application.nativeBuildVersion ?? "development",
      }),
    });

    const responseText = await response.text();

    console.log("WordPress push registration status:", response.status);
    console.log("WordPress push registration response:", responseText);

    if (!response.ok) {
      return {
        expoPushToken,
        success: false,
        httpStatus: response.status,
        responseText,
        statusMessage: `WordPress sync failed (${response.status}).`,
      };
    }

    return {
      expoPushToken,
      success: true,
      httpStatus: response.status,
      responseText,
      statusMessage: "Push token synced with WordPress.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("WordPress push registration error:", message);

    return {
      expoPushToken,
      success: false,
      statusMessage: `WordPress sync failed: ${message}`,
    };
  }
}