import Constants from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";

export default function NotificationBootstrap() {
  useEffect(() => {
    const shouldSkipPushRegistration =
      Constants.appOwnership === "expo" && Platform.OS === "android";

    if (shouldSkipPushRegistration) {
      console.log(
        "Push notifications skipped in Expo Go on Android. Use a development build for push-token testing.",
      );
      return;
    }

    async function setupNotifications() {
      const { registerForPushNotificationsAsync } = await import(
        "@/services/notifications/registerForPushNotifications"
      );

      await registerForPushNotificationsAsync();
    }

    setupNotifications();
  }, []);

  return null;
}