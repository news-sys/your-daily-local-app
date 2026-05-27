import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import NotificationBootstrap from "@/components/NotificationBootstrap";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NotificationBootstrap />

      <StatusBar style="dark" />

      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}