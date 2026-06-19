import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { trackEvent, trackScreenView } from "@/services/analytics";
import { getLiveVideoPosts } from "@/services/api";
import type { Post } from "@/types/Post";

function getYouTubeUrl(text?: string): string | null {
  if (!text) return null;

  const match = text.match(
    /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/shorts\/)[^\s]+)/i
  );

  return match?.[1] ?? null;
}

function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{6,})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

const VideoPlayer = memo(function VideoPlayer({ post }: { post: Post }) {
  const youtubeUrl = useMemo(() => getYouTubeUrl(post.body), [post.body]);
  const videoId = useMemo(
    () => (youtubeUrl ? getYouTubeVideoId(youtubeUrl) : null),
    [youtubeUrl]
  );

  const embedUrl = useMemo(() => {
    if (!videoId) return null;

    return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`;
  }, [videoId]);

  const openInYouTube = useCallback(() => {
    if (!youtubeUrl) return;

    trackEvent("screen_view", {
      screenName: "watch_youtube_open",
      postId: post.id,
      title: post.title,
    });

    Linking.openURL(youtubeUrl);
  }, [post.id, post.title, youtubeUrl]);

  const openArticle = useCallback(() => {
    trackEvent("article_open", {
      source: "watch",
      postId: post.id,
      title: post.title,
    });

    router.push({
      pathname: "/(tabs)/article",
      params: { id: String(post.id) },
    });
  }, [post.id, post.title]);

  if (!embedUrl) {
    return (
      <View style={styles.linkCard}>
        {post.image ? (
          <Image source={{ uri: post.image }} style={styles.linkImage} />
        ) : (
          <Ionicons name="logo-youtube" size={34} color="#b00020" />
        )}

        <Text style={styles.linkCardTitle}>{post.title}</Text>

        {post.excerpt ? (
          <Text style={styles.linkCardText}>{post.excerpt}</Text>
        ) : null}

        <Pressable style={styles.primaryButton} onPress={openArticle}>
          <Text style={styles.primaryButtonText}>Open Story</Text>
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

      <Text style={styles.featuredTitle}>{post.title}</Text>

      {post.excerpt ? (
        <Text style={styles.featuredDescription}>{post.excerpt}</Text>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.secondaryButton} onPress={openInYouTube}>
          <Ionicons name="logo-youtube" size={18} color="#fff" />
          <Text style={styles.secondaryButtonText}>Open on YouTube</Text>
        </Pressable>

        <Pressable style={styles.articleButton} onPress={openArticle}>
          <Text style={styles.articleButtonText}>Read Story</Text>
        </Pressable>
      </View>
    </View>
  );
});

const ReplayCard = memo(function ReplayCard({ post }: { post: Post }) {
  const youtubeUrl = useMemo(() => getYouTubeUrl(post.body), [post.body]);

  const openVideo = useCallback(() => {
    trackEvent("screen_view", {
      screenName: "watch_replay_open",
      postId: post.id,
      title: post.title,
    });

    if (youtubeUrl) {
      Linking.openURL(youtubeUrl);
      return;
    }

    router.push({
      pathname: "/(tabs)/article",
      params: { id: String(post.id) },
    });
  }, [post.id, post.title, youtubeUrl]);

  return (
    <Pressable style={styles.replayCard} onPress={openVideo}>
      {post.image ? (
        <Image source={{ uri: post.image }} style={styles.replayImage} />
      ) : (
        <View style={styles.replayPlaceholder}>
          <Ionicons name="play-circle" size={34} color="#999" />
        </View>
      )}

      <View style={styles.replayBody}>
        <Text style={styles.replayTitle}>{post.title}</Text>

        {post.date ? <Text style={styles.replayDate}>{post.date}</Text> : null}
      </View>
    </Pressable>
  );
});

export default function WatchScreen() {
  const [videos, setVideos] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const featuredVideo = videos[0];
  const replayVideos = videos.slice(1);

  const loadVideos = useCallback(async (refreshing = false) => {
    try {
      refreshing ? setIsRefreshing(true) : setIsLoading(true);
      setErrorMessage(null);

      if (refreshing) {
        trackEvent("screen_view", {
          screenName: "watch",
          action: "refresh",
        });
      }

      const result = await getLiveVideoPosts(1);
      setVideos(result.posts);
    } catch {
      setErrorMessage("Unable to load videos. Pull down to try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    trackScreenView("watch");
    loadVideos();
  }, [loadVideos]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading videos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadVideos(true)}
          />
        }
      >
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
            Watch live shows, community coverage, government meetings, and
            recent Your Daily Local video broadcasts.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {featuredVideo ? (
          <>
            <Text style={styles.sectionTitle}>Featured Video</Text>
            <VideoPlayer post={featuredVideo} />
          </>
        ) : (
          <View style={styles.linkCard}>
            <Ionicons name="play-circle" size={38} color="#999" />

            <Text style={styles.linkCardTitle}>No videos available</Text>

            <Text style={styles.linkCardText}>
              Live Video posts from YourDailyLocal.com will appear here.
            </Text>
          </View>
        )}

        {replayVideos.length > 0 ? (
          <View style={styles.replaySection}>
            <Text style={styles.sectionTitle}>Recent Videos</Text>

            {replayVideos.map((post) => (
              <ReplayCard key={String(post.id)} post={post} />
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
  loadingContainer: {
    alignItems: "center",
    backgroundColor: "#f6f6f6",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    color: "#666",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
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
  errorBox: {
    backgroundColor: "#fdecec",
    borderColor: "#f4b4b4",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  errorText: {
    color: "#8a1f1f",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  sectionTitle: {
    color: "#111",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
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
  featuredTitle: {
    color: "#111",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    marginTop: 14,
  },
  featuredDescription: {
    color: "#555",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#b00020",
    borderRadius: 999,
    flexDirection: "row",
    marginRight: 10,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 7,
  },
  articleButton: {
    alignItems: "center",
    backgroundColor: "#444",
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  articleButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  linkCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 24,
    padding: 20,
  },
  linkImage: {
    borderRadius: 14,
    height: 180,
    marginBottom: 14,
    width: "100%",
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
    alignSelf: "center",
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
  replayCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 12,
    overflow: "hidden",
  },
  replayImage: {
    height: 105,
    width: 115,
  },
  replayPlaceholder: {
    alignItems: "center",
    backgroundColor: "#e9e9e9",
    height: 105,
    justifyContent: "center",
    width: 115,
  },
  replayBody: {
    flex: 1,
    padding: 12,
  },
  replayTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  replayDate: {
    color: "#888",
    fontSize: 12,
    marginTop: 8,
  },
});