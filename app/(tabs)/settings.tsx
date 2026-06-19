import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { trackScreenView } from "@/services/analytics";
import {
    getNotificationPreferences,
    saveNotificationPreferences,
    type NotificationPreferenceKey,
    type NotificationPreferences,
} from "@/services/notificationPreferences";

const preferenceRows: {
  key: NotificationPreferenceKey;
  title: string;
  description: string;
}[] = [
  {
    key: "breakingNews",
    title: "Breaking News",
    description: "Major developing stories and urgent local updates.",
  },
  {
    key: "publicSafety",
    title: "Public Safety Alerts",
    description: "Police, fire, emergency management, and community safety alerts.",
  },
  {
    key: "weatherEmergencies",
    title: "Weather Emergencies",
    description: "Warnings and severe weather alerts affecting the local area.",
  },
  {
    key: "liveVideo",
    title: "Live Video",
    description: "Morning Pick-Up, meetings, events, and other live broadcasts.",
  },
];

export default function SettingsScreen() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(
    null
  );

  useEffect(() => {
    trackScreenView("settings");

    getNotificationPreferences().then(setPreferences);
  }, []);

  const updatePreference = useCallback(
    async (key: NotificationPreferenceKey, value: boolean) => {
      if (!preferences) return;

      const updatedPreferences = {
        ...preferences,
        [key]: value,
      };

      setPreferences(updatedPreferences);
      await saveNotificationPreferences(updatedPreferences);
    },
    [preferences]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="settings-outline" size={34} color="#b00020" />
          <Text style={styles.logoText}>Your Daily Local</Text>
          <Text style={styles.feedTitle}>Settings</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <Text style={styles.sectionDescription}>
            Choose which alerts you want to receive from Your Daily Local.
          </Text>

          {preferences
            ? preferenceRows.map((row) => (
                <View key={row.key} style={styles.preferenceRow}>
                  <View style={styles.preferenceText}>
                    <Text style={styles.preferenceTitle}>{row.title}</Text>
                    <Text style={styles.preferenceDescription}>
                      {row.description}
                    </Text>
                  </View>

                  <Switch
                    value={preferences[row.key]}
                    onValueChange={(value) => updatePreference(row.key, value)}
                  />
                </View>
              ))
            : null}
        </View>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#111",
    flex: 1,
  },
  container: {
    backgroundColor: "#f6f6f6",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  logoText: {
    color: "#111",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 6,
  },
  feedTitle: {
    color: "#666",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
  },
  sectionTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
  },
  sectionDescription: {
    color: "#555",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 10,
  },
  preferenceRow: {
    alignItems: "center",
    borderTopColor: "#eee",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  preferenceText: {
    flex: 1,
    paddingRight: 14,
  },
  preferenceTitle: {
    color: "#111",
    fontSize: 17,
    fontWeight: "900",
  },
  preferenceDescription: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  versionText: {
    color: "#888",
    fontSize: 13,
    marginTop: 18,
    textAlign: "center",
  },
});