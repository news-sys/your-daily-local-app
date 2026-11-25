import Constants from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";

export default function NotificationBootstrap() {
  useEffect(() => {
    const shouldSkipPushRegistration =
      Constants.appOwnership === "expo" &&
      Platform.OS === "android";

    if (shouldSkipPushRegistration) {
      console.log(
        "Push notifications skipped in Expo Go on Android. Use a development build for push-token testing."
      );
      return;
    }

    async function bootstrap() {
      try {
        const {
          getCurrentExpoPushToken,
          syncPushRegistration,
        } = await import(
          "@/services/notifications/pushService"
        );

        const token =
          await getCurrentExpoPushToken();

        if (!token) {
          console.log(
            "Push registration skipped: no token returned."
          );
          return;
        }

        console.log("Expo push token loaded.");

        const result =
          await syncPushRegistration(
            undefined,
            token
          );

        console.log(result.statusMessage);
      } catch (error) {
        console.error(
          "Push bootstrap failed:",
          error instanceof Error
            ? error.message
            : error
        );
      }
    }

    bootstrap();
  }, []);

  return null;
}