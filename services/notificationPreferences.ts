import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationPreferenceKey =
  | "breakingNews"
  | "publicSafety"
  | "weatherEmergencies"
  | "liveVideo";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

const STORAGE_KEY = "ydl_notification_preferences";

export const defaultNotificationPreferences: NotificationPreferences = {
  breakingNews: true,
  publicSafety: true,
  weatherEmergencies: true,
  liveVideo: false,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultNotificationPreferences;
    }

    return {
      ...defaultNotificationPreferences,
      ...JSON.parse(raw),
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}