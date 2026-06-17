import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { memo, useCallback, useEffect, useMemo } from "react";
import {
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { liveStreams, type LiveStream } from "@/data/liveStreams";
import { trackEvent, trackScreenView } from "@/services/analytics";

function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{6,})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

const StreamPlayer = memo(function StreamPlayer({
  stream,
}: {
  stream: LiveStream;
}) {
  const videoId = useMemo(
    () => getYouTubeVideoId(stream.youtubeUrl),
    [stream.youtubeUrl]
  );

  const embedUrl = useMemo(() => {
    if (!videoId) return null;

    return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`;
  }, [videoId]);

  const openInYouTube = useCallback(() => {
    trackEvent("screen_view", {
      screenName: "watch_youtube_open",
      streamId: stream.id,
      title: stream.title,
      status: stream.status,
    });

    Linking.openURL(stream.youtubeUrl);
  }, [stream]);

  if (!embedUrl) {
    return (
      <View style={styles.linkCard}>
        <Ionicons name="logo-youtube" size={34} color="#b00020" />
        <Text style={styles.linkCardTitle}>{stream.title}</Text>
        <Text style={styles.linkCardText}>
          Tap below to open this live stream or replay on YouTube.
        </Text>

        <Pressable style={styles.primaryButton} onPress={openInYouTube}>
          <Text style={styles.primaryButtonText}>Open on YouTube</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.playerBlock}>
      <View style={styles.videoWrapper}>
        <WebView
          source={{
            uri: embedUrl,
            headers: {
              Referer: "https://yourdailylocal.com",
            },
          }}
          style={styles.videoWebView}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction
          originWhitelist={["*"]}
          scrollEnabled={false}
          setSupportMultipleWindows={false}
        />
      </View>

      <Pressable style={styles.secondaryButton} onPress={openInYouTube}>
        <Ionicons name="logo-youtube" size={18} color="#fff" />
        <Text style={styles.secondaryButtonText}>Open on YouTube</Text>
      </Pressable>
    </View>
  );
});

const StreamCard = memo(function StreamCard({ stream }: { stream: LiveStream }) {
  const openStream = useCallback(() => {
    trackEvent("screen_view", {
      screenName: "watch_stream_open",
      streamId: stream.id,
      title: stream.title,
      status: stream.status,
    });

    Linking.openURL(stream.youtubeUrl);
  }, [stream]);

  return (
    <View style={styles.streamCard}>
      <View style={styles.streamHeader}>
        <Text
          style={[
            styles.statusBadge,
            stream.status === "live"
              ? styles.liveBadge
              : stream.status === "upcoming"
                ? styles.upcomingBadge
                : styles.replayBadge,
          ]}
        >
          {stream.status === "live"
            ? "Live"
            : stream.status === "upcoming"
              ? "Upcoming"
              : "Replay"}
        </Text>

        <Text style={styles.streamDate}>{stream.publishedAt}</Text>
      </View>

      <Text style={styles.streamTitle}>{stream.title}</Text>
      <Text style={styles.streamDescription}>{stream.description}</Text>

      <Pressable style={styles.primaryButton} onPress={openStream}>
        <Text style={styles.primaryButtonText}>Watch</Text>
      </Pressable>
    </View>
  );
});

export default function WatchScreen() {
  const featuredStream = liveStreams[0];
  const replayStreams = liveStreams.slice(1);

  useEffect(() => {
    trackScreenView("watch");
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logoText}>Your Daily Local</Text>
          <Text style={styles.feedTitle}>Watch</Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Live & Featured Video</Text>

          <Text style={styles.heroTitle}>
            Morning Pick-Up and Your Daily Local broadcasts
          </Text>

          <Text style={styles.heroText}>
            Watch live shows, community coverage, and recent Your Daily Local
            video broadcasts.
          </Text>
        </View>

        {featuredStream ? (
          <>
            <Text style={styles.sectionTitle}>{featuredStream.title}</Text>
            <Text style={styles.sectionDescription}>
              {featuredStream.description}
            </Text>

            <StreamPlayer stream={featuredStream} />
          </>
        ) : null}

        {replayStreams.length > 0 ? (
          <View style={styles.replaySection}>
            <Text style={styles.sectionTitle}>Recent Replays</Text>

            {replayStreams.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </View>
        ) : null}
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
  },
  feedTitle: {
    color: "#666",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
    textTransform: "uppercase",
  },
  heroCard: {
    backgroundColor: "#111",
    borderRadius: 18,
    marginBottom: 22,
    padding: 18,
  },
  heroEyebrow: {
    color: "#ffccd3",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  heroText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  sectionTitle: {
    color: "#111",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  sectionDescription: {
    color: "#555",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  playerBlock: {
    marginBottom: 24,
  },
  videoWrapper: {
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  videoWebView: {
    backgroundColor: "#000",
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#b00020",
    borderRadius: 999,
    flexDirection: "row",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 7,
  },
  linkCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 24,
    padding: 20,
  },
  linkCardTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  linkCardText: {
    color: "#555",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#b00020",
    borderRadius: 999,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  replaySection: {
    marginTop: 8,
  },
  streamCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 14,
    padding: 16,
  },
  streamHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusBadge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  liveBadge: {
    backgroundColor: "#b00020",
    color: "#fff",
  },
  upcomingBadge: {
    backgroundColor: "#111",
    color: "#fff",
  },
  replayBadge: {
    backgroundColor: "#e8e8e8",
    color: "#333",
  },
  streamDate: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
  },
  streamTitle: {
    color: "#111",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 25,
  },
  streamDescription: {
    color: "#555",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
});