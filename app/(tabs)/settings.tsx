import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  trackScreenView,
} from "@/services/analytics";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/services/notificationPreferences";
import {
  getCurrentExpoPushToken,
  syncPushRegistration,
} from "@/services/notifications/pushService";

const PRIVACY_POLICY_URL =
  "https://yourdailylocal.com/privacy-policy/";

const CONTACT_EMAIL =
  "bhagberg@yourdailylocal.com";

const APP_VERSION =
  Application.nativeApplicationVersion ??
  "development";

const BUILD_VERSION =
  Application.nativeBuildVersion ??
  "development";

const preferenceRows: {
  key: NotificationPreferenceKey;
  title: string;
  description: string;
}[] = [
  {
    key: "breakingNews",
    title: "Breaking News",
    description:
      "Major developing stories and urgent local updates.",
  },
  {
    key: "publicSafety",
    title: "Public Safety Alerts",
    description:
      "Police, fire, emergency management, and community safety alerts.",
  },
  {
    key: "weatherEmergencies",
    title: "Weather Emergencies",
    description:
      "Severe weather alerts and weather-related safety updates.",
  },
  {
    key: "liveVideo",
    title: "Live Video",
    description:
      "Alerts when Your Daily Local is live.",
  },
];

export default function SettingsScreen() {
  const [
    preferences,
    setPreferences,
  ] =
    useState<NotificationPreferences | null>(
      null
    );

  const [
    pushToken,
    setPushToken,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    trackScreenView(
      "settings"
    );

    async function loadSettings() {
      const savedPreferences =
        await getNotificationPreferences();

      setPreferences(
        savedPreferences
      );

      const token =
        await getCurrentExpoPushToken();

      if (!token) {
        setPushToken(
          null
        );

        return;
      }

      setPushToken(
        token
      );

      await syncPushRegistration(
        savedPreferences,
        token
      );
    }

    void loadSettings();
  }, []);

  const updatePreference =
    useCallback(
      async (
        key: NotificationPreferenceKey,
        value: boolean
      ) => {
        if (!preferences) {
          return;
        }

        const updatedPreferences = {
          ...preferences,
          [key]: value,
        };

        setPreferences(
          updatedPreferences
        );

        await saveNotificationPreferences(
          updatedPreferences
        );

        const result =
          await syncPushRegistration(
            updatedPreferences,
            pushToken
          );

        if (
          result.expoPushToken
        ) {
          setPushToken(
            result.expoPushToken
          );
        }
      },
      [
        preferences,
        pushToken,
      ]
    );

  const openPrivacyPolicy =
    useCallback(() => {
      void Linking.openURL(
        PRIVACY_POLICY_URL
      );
    }, []);

  const contactUs =
    useCallback(() => {
      void Linking.openURL(
        `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
          "Your Daily Local App Contact"
        )}`
      );
    }, []);

  const sendFeedback =
    useCallback(() => {
      void Linking.openURL(
        `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
          "YDL App Feedback"
        )}`
      );
    }, []);

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <StatusBar
        style="dark"
      />

      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Text
            style={
              styles.title
            }
          >
            Settings
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Choose the alerts you want to receive
            and find ways to contact Your Daily
            Local.
          </Text>
        </View>

        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={
                styles.sectionIcon
              }
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#b00020"
              />
            </View>

            <View
              style={
                styles.sectionHeaderText
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Notifications
              </Text>

              <Text
                style={
                  styles.sectionDescription
                }
              >
                Choose which YDL alerts appear on
                this device.
              </Text>
            </View>
          </View>

          <View
            style={
              styles.divider
            }
          />

          {preferenceRows.map(
            (
              row,
              index
            ) => (
              <View
                key={
                  row.key
                }
              >
                <View
                  style={
                    styles.preferenceRow
                  }
                >
                  <View
                    style={
                      styles.preferenceText
                    }
                  >
                    <Text
                      style={
                        styles.rowTitle
                      }
                    >
                      {
                        row.title
                      }
                    </Text>

                    <Text
                      style={
                        styles.rowDescription
                      }
                    >
                      {
                        row.description
                      }
                    </Text>
                  </View>

                  <Switch
                    value={
                      preferences?.[
                        row.key
                      ] ??
                      false
                    }
                    onValueChange={(
                      value
                    ) =>
                      void updatePreference(
                        row.key,
                        value
                      )
                    }
                    disabled={
                      !preferences
                    }
                    trackColor={{
                      false:
                        "#d1d5db",
                      true:
                        "#d97a8c",
                    }}
                    thumbColor={
                      preferences?.[
                        row.key
                      ]
                        ? "#b00020"
                        : "#f9fafb"
                    }
                  />
                </View>

                {index <
                preferenceRows.length -
                  1 ? (
                  <View
                    style={
                      styles.rowDivider
                    }
                  />
                ) : null}
              </View>
            )
          )}

          <Text
            style={
              styles.notificationNote
            }
          >
            You can change these preferences at any
            time.
          </Text>
        </View>

        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.supportTitle
            }
          >
            Support & Information
          </Text>

          <Pressable
            style={
              styles.linkRow
            }
            onPress={
              openPrivacyPolicy
            }
          >
            <View
              style={
                styles.linkIcon
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color="#1f2937"
              />
            </View>

            <View
              style={
                styles.linkText
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Privacy Policy
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                Review how app information is
                handled.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#9ca3af"
            />
          </Pressable>

          <View
            style={
              styles.linkDivider
            }
          />

          <Pressable
            style={
              styles.linkRow
            }
            onPress={
              contactUs
            }
          >
            <View
              style={
                styles.linkIcon
              }
            >
              <Ionicons
                name="mail-outline"
                size={22}
                color="#1f2937"
              />
            </View>

            <View
              style={
                styles.linkText
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Contact Us
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                Reach the Your Daily Local team.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#9ca3af"
            />
          </Pressable>

          <View
            style={
              styles.linkDivider
            }
          />

          <Pressable
            style={
              styles.linkRow
            }
            onPress={
              sendFeedback
            }
          >
            <View
              style={
                styles.linkIcon
              }
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color="#1f2937"
              />
            </View>

            <View
              style={
                styles.linkText
              }
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Send Feedback
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                Report an issue or suggest an
                improvement.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#9ca3af"
            />
          </Pressable>
        </View>

        <View
          style={
            styles.versionCard
          }
        >
          <Text
            style={
              styles.versionTitle
            }
          >
            Your Daily Local
          </Text>

          <Text
            style={
              styles.versionText
            }
          >
            Version {APP_VERSION} · Build{" "}
            {BUILD_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#f3f4f6",
    },

    container: {
      padding: 18,
      paddingBottom: 40,
    },

    header: {
      marginBottom: 20,
    },

    title: {
      fontSize: 30,
      fontWeight: "800",
      color: "#111827",
    },

    subtitle: {
      marginTop: 6,
      fontSize: 15,
      lineHeight: 21,
      color: "#6b7280",
    },

    card: {
      backgroundColor:
        "#ffffff",
      borderRadius: 18,
      marginBottom: 16,
      overflow: "hidden",
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
    },

    sectionIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        "#fce8ec",
      marginRight: 12,
    },

    sectionHeaderText: {
      flex: 1,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: "#111827",
    },

    sectionDescription: {
      marginTop: 2,
      fontSize: 13,
      lineHeight: 18,
      color: "#6b7280",
    },

    divider: {
      height: 1,
      backgroundColor:
        "#e5e7eb",
    },

    preferenceRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 14,
    },

    preferenceText: {
      flex: 1,
    },

    rowDivider: {
      height: 1,
      backgroundColor:
        "#f0f1f3",
      marginLeft: 16,
    },

    rowTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#111827",
    },

    rowDescription: {
      marginTop: 3,
      fontSize: 13,
      lineHeight: 18,
      color: "#6b7280",
    },

    notificationNote: {
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 16,
      color: "#6b7280",
      fontSize: 12,
      lineHeight: 17,
    },

    supportTitle: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
      fontSize: 13,
      fontWeight: "800",
      color: "#6b7280",
      textTransform:
        "uppercase",
      letterSpacing: 0.5,
    },

    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 15,
    },

    linkIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      marginRight: 12,
    },

    linkText: {
      flex: 1,
      marginRight: 10,
    },

    linkDivider: {
      height: 1,
      backgroundColor:
        "#f0f1f3",
      marginLeft: 62,
    },

    versionCard: {
      alignItems: "center",
      marginTop: 8,
    },

    versionTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: "#374151",
    },

    versionText: {
      marginTop: 4,
      fontSize: 13,
      color: "#6b7280",
    },
  });