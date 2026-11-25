import * as Notifications from "expo-notifications";
import {
  router,
  Stack,
  useRootNavigationState,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useEffect,
  useRef,
} from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import NotificationBootstrap from "@/components/NotificationBootstrap";

type NotificationData = {
  postId?: string | number;
  articleId?: string | number;
  type?: string;
  notificationType?: string;
  category?: string;
  destination?: string;
  route?: string;
};

function normalizeNotificationValue(
  value: unknown
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(
      /[\s_]+/g,
      "-"
    );
}

function isLiveVideoNotification(
  data: NotificationData
): boolean {
  const values = [
    data.type,
    data.notificationType,
    data.category,
    data.destination,
    data.route,
  ]
    .map(
      normalizeNotificationValue
    )
    .filter(Boolean);

  return values.some(
    (value) =>
      value === "live-video" ||
      value === "livevideo" ||
      value === "watch" ||
      value === "live"
  );
}

function openNotificationDestination(
  response:
    | Notifications.NotificationResponse
    | null
): void {
  if (!response) {
    return;
  }

  const data =
    response.notification
      .request.content
      .data as NotificationData;

  if (
    isLiveVideoNotification(
      data
    )
  ) {
    router.replace(
      "/(tabs)/watch"
    );

    return;
  }

  const postId =
    data.postId ??
    data.articleId;

  if (
    postId === undefined ||
    postId === null
  ) {
    return;
  }

  const normalizedPostId =
    String(postId).trim();

  if (!normalizedPostId) {
    return;
  }

  router.push({
    pathname:
      "/(tabs)/article",
    params: {
      id: normalizedPostId,
      fresh: "1",
    },
  });
}

export default function RootLayout() {
  const rootNavigationState =
    useRootNavigationState();

  const initialNotificationHandledRef =
    useRef(false);

  useEffect(() => {
    if (
      !rootNavigationState?.key ||
      initialNotificationHandledRef.current
    ) {
      return;
    }

    initialNotificationHandledRef.current =
      true;

    async function handleInitialNotification(): Promise<void> {
      try {
        const response =
          await Notifications.getLastNotificationResponseAsync();

        if (!response) {
          return;
        }

        openNotificationDestination(
          response
        );

        await Notifications.clearLastNotificationResponseAsync();
      } catch (error) {
        console.warn(
          "Unable to process the initial notification response:",
          error
        );
      }
    }

    void handleInitialNotification();
  }, [rootNavigationState?.key]);

  useEffect(() => {
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          openNotificationDestination(
            response
          );
        }
      );

    return () => {
      responseSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NotificationBootstrap />

      <StatusBar
        style="dark"
      />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </SafeAreaProvider>
  );
}