import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import {
  trackEvent,
  trackScreenView,
} from "@/services/analytics";
import { getLiveVideoPosts } from "@/services/api";
import type { Post } from "@/types/Post";
import { formatDisplayDate } from "@/utils/formatDisplayDate";

const WATCH_FOCUS_REFRESH_MS = 60 * 1000;
const BACK_TO_TOP_THRESHOLD = 700;

type WatchLoadMode = "initial" | "manual" | "background";

function getYouTubeUrl(
  ...sources: Array<string | undefined | null>
): string | null {
  const patterns = [
    /https?:\/\/(?:www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]{6,}[^\s"'<>]*/i,
    /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{6,}[^\s"'<>]*/i,
    /https?:\/\/(?:www\.)?youtube\.com\/live\/[a-zA-Z0-9_-]{6,}[^\s"'<>]*/i,
    /https?:\/\/(?:www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_-]{6,}[^\s"'<>]*/i,
    /https?:\/\/youtu\.be\/[a-zA-Z0-9_-]{6,}[^\s"'<>]*/i,
  ];

  for (const source of sources) {
    if (!source) continue;

    const decoded = source
      .replace(/&amp;/gi, "&")
      .replace(/&#038;/gi, "&");

    for (const pattern of patterns) {
      const match = decoded.match(pattern);
      if (match?.[0]) return match[0];
    }
  }

  return null;
}

function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/i,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function getPostYouTubeUrl(post: Post): string | null {
  const postWithPossibleHtml = post as Post & {
    bodyHtml?: string;
    content?: string;
    contentHtml?: string;
  };

  return getYouTubeUrl(
    postWithPossibleHtml.bodyHtml,
    postWithPossibleHtml.contentHtml,
    postWithPossibleHtml.content,
    post.body
  );
}

const VideoPlayer = memo(function VideoPlayer({
  post,
  isPlaying,
  onPlay,
}: {
  post: Post;
  isPlaying: boolean;
  onPlay: (postId: number) => void;
}) {
  const youtubeUrl = useMemo(
    () => getPostYouTubeUrl(post),
    [post]
  );

  const videoId = useMemo(
    () => (youtubeUrl ? getYouTubeVideoId(youtubeUrl) : null),
    [youtubeUrl]
  );

  const embedUrl = useMemo(() => {
    if (!videoId) return null;

    return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&autoplay=1`;
  }, [videoId]);

  const youtubeWatchUrl = useMemo(() => {
    if (!videoId) return youtubeUrl;

    return `https://www.youtube.com/watch?v=${videoId}`;
  }, [videoId, youtubeUrl]);

  const openInYouTube = useCallback(() => {
    if (!youtubeWatchUrl) return;

    trackEvent("screen_view", {
      screenName: "watch_youtube_open",
      postId: post.id,
      title: post.title,
    });

    void Linking.openURL(youtubeWatchUrl);
  }, [post.id, post.title, youtubeWatchUrl]);

  const openArticle = useCallback(() => {
    trackEvent("article_open", {
      source: "watch",
      postId: post.id,
      title: post.title,
    });

    router.push({
      pathname: "/(tabs)/article",
      params: {
        id: String(post.id),
        fresh: "1",
      },
    });
  }, [post.id, post.title]);

  const shareVideo = useCallback(async () => {
    const shareUrl = post.link ?? youtubeWatchUrl;

    const message = shareUrl
      ? `${post.title}\n\n${shareUrl}`
      : `${post.title}\n\nShared from Your Daily Local`;

    try {
      await Share.share({
        title: post.title,
        message,
      });

      trackEvent("shared_story", {
        source: "watch",
        postId: post.id,
        title: post.title,
      });
    } catch {
      // Sharing was canceled or could not be completed.
    }
  }, [post.id, post.link, post.title, youtubeWatchUrl]);

  if (!embedUrl) {
    return (
      <View style={styles.linkCard}>
        {post.image ? (
          <Image
            source={{ uri: post.image }}
            style={styles.linkImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={String(post.id)}
          />
        ) : (
          <Ionicons
            name="logo-youtube"
            size={34}
            color="#b00020"
          />
        )}

        <Text style={styles.linkCardTitle}>
          {post.title}
        </Text>

        {post.excerpt ? (
          <Text style={styles.linkCardText}>
            {post.excerpt}
          </Text>
        ) : null}

        <View style={styles.buttonRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={openArticle}
          >
            <Text style={styles.primaryButtonText}>
              Open Story
            </Text>
          </Pressable>

          <Pressable
            style={styles.shareButton}
            onPress={() => void shareVideo()}
          >
            <Ionicons
              name="share-social-outline"
              size={17}
              color="#fff"
            />
            <Text style={styles.shareButtonText}>
              Share
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.playerBlock}>
      <View style={styles.videoWrapper}>
        {isPlaying ? (
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
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={["*"]}
            scrollEnabled={false}
            setSupportMultipleWindows={false}
          />
        ) : (
          <Pressable
            style={styles.videoPreview}
            onPress={() => onPlay(post.id)}
            accessibilityRole="button"
            accessibilityLabel={`Play ${post.title}`}
          >
            <Image
              source={{
                uri:
                  post.image ||
                  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={String(post.id)}
            />

            <View style={styles.playBadge}>
              <Ionicons
                name="play"
                size={34}
                color="#fff"
              />
            </View>
          </Pressable>
        )}
      </View>

      <Text style={styles.featuredTitle}>
        {post.title}
      </Text>

      {post.excerpt ? (
        <Text style={styles.featuredDescription}>
          {post.excerpt}
        </Text>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={openInYouTube}
        >
          <Ionicons
            name="logo-youtube"
            size={18}
            color="#fff"
          />
          <Text style={styles.secondaryButtonText}>
            Open on YouTube
          </Text>
        </Pressable>

        <Pressable
          style={styles.shareButton}
          onPress={() => void shareVideo()}
        >
          <Ionicons
            name="share-social-outline"
            size={17}
            color="#fff"
          />
          <Text style={styles.shareButtonText}>
            Share
          </Text>
        </Pressable>

        <Pressable
          style={styles.articleButton}
          onPress={openArticle}
        >
          <Text style={styles.articleButtonText}>
            Read Story
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const ReplayCard = memo(function ReplayCard({
  post,
}: {
  post: Post;
}) {
  const youtubeUrl = useMemo(
    () => getPostYouTubeUrl(post),
    [post]
  );

  const videoId = useMemo(
    () => (youtubeUrl ? getYouTubeVideoId(youtubeUrl) : null),
    [youtubeUrl]
  );

  const youtubeWatchUrl = useMemo(() => {
    if (!videoId) return youtubeUrl;

    return `https://www.youtube.com/watch?v=${videoId}`;
  }, [videoId, youtubeUrl]);

  const openVideo = useCallback(() => {
    trackEvent("screen_view", {
      screenName: "watch_replay_open",
      postId: post.id,
      title: post.title,
    });

    if (youtubeWatchUrl) {
      void Linking.openURL(youtubeWatchUrl);
      return;
    }

    router.push({
      pathname: "/(tabs)/article",
      params: {
        id: String(post.id),
        fresh: "1",
      },
    });
  }, [post.id, post.title, youtubeWatchUrl]);

  return (
    <Pressable
      style={styles.replayCard}
      onPress={openVideo}
    >
      {post.image ? (
        <Image
          source={{ uri: post.image }}
          style={styles.replayImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={String(post.id)}
        />
      ) : (
        <View style={styles.replayPlaceholder}>
          <Ionicons
            name="play-circle"
            size={34}
            color="#999"
          />
        </View>
      )}

      <View style={styles.replayBody}>
        <Text style={styles.replayTitle}>
          {post.title}
        </Text>

        {post.date ? (
          <Text style={styles.replayDate}>
            {formatDisplayDate(post.date)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

export default function WatchScreen() {
  const scrollRef = useRef<ScrollView>(null);

  const [playingPostId, setPlayingPostId] = useState<
    number | null
  >(null);

  const playVideo = useCallback((postId: number) => {
    setPlayingPostId(postId);
  }, []);

  // Stop the embedded player when navigating away.
  useFocusEffect(
    useCallback(() => {
      return () => setPlayingPostId(null);
    }, [])
  );

  // Stop playback when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state !== "active") {
          setPlayingPostId(null);
        }
      }
    );

    return () => subscription.remove();
  }, []);

  const [videos, setVideos] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const isLoadingRef = useRef(false);
  const videosRef = useRef<Post[]>([]);
  const lastRefreshRef = useRef(0);
  const hasReceivedInitialFocusRef = useRef(false);
  const hasCompletedInitialLoadRef = useRef(false);

  const featuredVideos = useMemo(
    () => videos.slice(0, 2),
    [videos]
  );

  const replayVideos = useMemo(
    () => videos.slice(2),
    [videos]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const shouldShow =
        event.nativeEvent.contentOffset.y >=
        BACK_TO_TOP_THRESHOLD;

      setShowBackToTop((current) =>
        current === shouldShow ? current : shouldShow
      );
    },
    []
  );

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, []);

  const loadVideos = useCallback(
    async (mode: WatchLoadMode = "initial") => {
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;
      const forceRefresh = mode !== "initial";

      try {
        if (mode === "initial") {
          setIsLoading(true);
        } else if (mode === "manual") {
          setIsRefreshing(true);
        }

        if (mode !== "background") {
          setErrorMessage(null);
        }

        if (mode === "manual") {
          trackEvent("screen_view", {
            screenName: "watch",
            action: "refresh",
          });
        }

        const result = await getLiveVideoPosts(1, {
          forceRefresh,
        });

        // Preserve visible videos if a refresh returns empty.
        if (
          result.posts.length > 0 ||
          videosRef.current.length === 0
        ) {
          videosRef.current = result.posts;
          setVideos(result.posts);
        }

        setErrorMessage(null);
        lastRefreshRef.current = Date.now();
        hasCompletedInitialLoadRef.current = true;
      } catch (error) {
        console.warn(
          "[Watch] Unable to refresh video feed:",
          error
        );

        if (
          mode !== "background" &&
          videosRef.current.length === 0
        ) {
          setErrorMessage(
            "Unable to load videos. Pull down to try again."
          );
        }
      } finally {
        isLoadingRef.current = false;

        if (mode === "initial") {
          setIsLoading(false);
        }

        if (mode === "manual") {
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    trackScreenView("watch");

    // One initial request; later refreshes are deliberate.
    void loadVideos("initial");
  }, [loadVideos]);

  useFocusEffect(
    useCallback(() => {
      if (!hasReceivedInitialFocusRef.current) {
        hasReceivedInitialFocusRef.current = true;
        return;
      }

      if (!hasCompletedInitialLoadRef.current) {
        return;
      }

      const timeSinceRefresh =
        Date.now() - lastRefreshRef.current;

      if (timeSinceRefresh >= WATCH_FOCUS_REFRESH_MS) {
        void loadVideos("background");
      }
    }, [loadVideos])
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right"]}
      >
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>
            Loading videos...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <StatusBar style="light" />

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadVideos("manual")}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        <View style={styles.header}>
          <Text style={styles.logoText}>
            Your Daily Local
          </Text>
          <Text style={styles.feedTitle}>Watch</Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>
            Live &amp; Featured Video
          </Text>
          <Text style={styles.heroTitle}>
            Morning Pick-Up and Your Daily Local broadcasts
          </Text>
          <Text style={styles.heroText}>
            Watch live shows, community coverage,
            government meetings, and recent Your Daily
            Local video broadcasts.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {featuredVideos.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {featuredVideos.length > 1
                ? "Featured Videos"
                : "Featured Video"}
            </Text>

            {featuredVideos.map((post) => (
              <VideoPlayer
                key={String(post.id)}
                post={post}
                isPlaying={playingPostId === post.id}
                onPlay={playVideo}
              />
            ))}
          </>
        ) : (
          <View style={styles.linkCard}>
            <Ionicons
              name="play-circle"
              size={38}
              color="#999"
            />
            <Text style={styles.linkCardTitle}>
              No videos available
            </Text>
            <Text style={styles.linkCardText}>
              Live Video posts from YourDailyLocal.com
              will appear here.
            </Text>
          </View>
        )}

        {replayVideos.length > 0 ? (
          <View style={styles.replaySection}>
            <Text style={styles.sectionTitle}>
              Recent Videos
            </Text>

            {replayVideos.map((post) => (
              <ReplayCard
                key={String(post.id)}
                post={post}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {showBackToTop ? (
        <Pressable
          style={styles.backToTopButton}
          onPress={scrollToTop}
          accessibilityRole="button"
          accessibilityLabel="Back to top"
        >
          <Ionicons
            name="arrow-up"
            size={18}
            color="#fff"
          />
          <Text style={styles.backToTopText}>Top</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  videoPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  playBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 40,
    width: 72,
    height: 72,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
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
  shareButton: {
    alignItems: "center",
    backgroundColor: "#1f6ed4",
    borderRadius: 999,
    flexDirection: "row",
    marginRight: 10,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  shareButtonText: {
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
    marginRight: 10,
    marginTop: 8,
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
  backToTopButton: {
    alignItems: "center",
    backgroundColor: "rgba(17, 17, 17, 0.92)",
    borderRadius: 999,
    bottom: 18,
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "absolute",
    right: 16,
  },
  backToTopText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 5,
  },
});