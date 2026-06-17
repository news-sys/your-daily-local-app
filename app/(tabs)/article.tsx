import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
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
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import RotatingAdSlot from "@/components/RotatingAdSlot";
import {
  trackArticleOpen,
  trackSavedStory,
  trackSharedStory,
} from "@/services/analytics";
import { getPostById, getPostsByCategory } from "@/services/api";
import { isPostSaved, toggleSavedPost } from "@/services/savedPosts";
import type { Post } from "@/types/Post";

type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "youtube"; videoId: string; originalUrl: string };

function getYouTubeVideoId(text: string): string | null {
  const trimmed = text.trim();

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{6,})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function formatArticleBlocks(body?: string): ArticleBlock[] {
  if (!body) return [];

  return body
    .split(/\n{1,}|\r\n{1,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const videoId = getYouTubeVideoId(block);

      if (videoId) {
        return {
          type: "youtube",
          videoId,
          originalUrl: block,
        };
      }

      return {
        type: "paragraph",
        text: block,
      };
    });
}

function formatDisplayDate(date?: string): string {
  if (!date) return "";

  try {
    return new Date(date).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return date;
  }
}

const YouTubeEmbed = memo(function YouTubeEmbed({
  videoId,
  originalUrl,
}: {
  videoId: string;
  originalUrl: string;
}) {
  const embedUrl = useMemo(
    () =>
      `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`,
    [videoId]
  );

  const openInYouTube = useCallback(() => {
    Linking.openURL(originalUrl);
  }, [originalUrl]);

  return (
    <View style={styles.youtubeContainer}>
      <View style={styles.youtubeWrapper}>
        <WebView
          source={{
            uri: embedUrl,
            headers: {
              Referer: "https://yourdailylocal.com",
            },
          }}
          style={styles.youtubeWebView}
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

      <Pressable style={styles.youtubeFallbackButton} onPress={openInYouTube}>
        <Ionicons name="logo-youtube" size={18} color="#fff" />
        <Text style={styles.youtubeFallbackText}>Open video on YouTube</Text>
      </Pressable>
    </View>
  );
});

const RelatedStoryCard = memo(function RelatedStoryCard({
  post,
}: {
  post: Post;
}) {
  const openStory = useCallback(() => {
    router.push({
      pathname: "/(tabs)/article",
      params: { id: String(post.id) },
    });
  }, [post.id]);

  return (
    <Pressable style={styles.relatedCard} onPress={openStory}>
      {post.image ? (
        <Image
          source={{ uri: post.image }}
          style={styles.relatedImage}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}

      <View style={styles.relatedContent}>
        <Text style={styles.relatedCategory}>{post.category}</Text>
        <Text style={styles.relatedHeadline}>{post.title}</Text>
      </View>
    </Pressable>
  );
});

const ArticleContentBlock = memo(function ArticleContentBlock({
  block,
  index,
  totalBlocks,
}: {
  block: ArticleBlock;
  index: number;
  totalBlocks: number;
}) {
  const isAfterSecondBlock = index === 1;
  const isAfterFifthBlock = index === 4;
  const isAfterLastBlock = index === totalBlocks - 1;

  return (
    <View>
      {block.type === "youtube" ? (
        <YouTubeEmbed videoId={block.videoId} originalUrl={block.originalUrl} />
      ) : (
        <Text style={styles.body}>{block.text}</Text>
      )}

      {isAfterSecondBlock ? (
        <RotatingAdSlot placement="article-after-2" />
      ) : null}

      {isAfterFifthBlock ? (
        <RotatingAdSlot placement="article-after-5" />
      ) : null}

      {isAfterLastBlock ? (
        <RotatingAdSlot placement="article-bottom" />
      ) : null}
    </View>
  );
});

export default function ArticleScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;

  const trackedArticleIdRef = useRef<number | null>(null);

  const [post, setPost] = useState<Post | undefined>();
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const articleBlocks = useMemo(
    () => formatArticleBlocks(post?.body),
    [post?.body]
  );

  const loadPost = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const result = await getPostById(id);

      setPost(result);

      if (result) {
        if (trackedArticleIdRef.current !== result.id) {
          trackArticleOpen(result.id, result.title);
          trackedArticleIdRef.current = result.id;
        }

        const [saved, related] = await Promise.all([
          isPostSaved(result.id),
          result.category
            ? getPostsByCategory(result.category)
            : Promise.resolve(null),
        ]);

        setIsSaved(saved);

        if (related) {
          setRelatedPosts(
            related.posts
              .filter((relatedPost: Post) => relatedPost.id !== result.id)
              .slice(0, 3)
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const shareArticle = useCallback(async () => {
    if (!post) return;

    try {
      await Share.share({
        title: post.title,
        message: `${post.title}\n\nShared from Your Daily Local`,
      });

      trackSharedStory(post.id, post.title);
    } catch {
      // Share canceled
    }
  }, [post]);

  const handleToggleSaved = useCallback(async () => {
    if (!post || isSaving) return;

    try {
      setIsSaving(true);
      const nextSavedState = await toggleSavedPost(post);
      setIsSaved(nextSavedState);

      if (nextSavedState) {
        trackSavedStory(post.id, post.title);
      }
    } finally {
      setIsSaving(false);
    }
  }, [post, isSaving]);

  const goBack = useCallback(() => {
    router.back();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading story...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <Text style={styles.notFoundTitle}>Story not found</Text>
          <Text style={styles.centerText}>This story could not be loaded.</Text>

          <Pressable style={styles.backButtonLarge} onPress={goBack}>
            <Text style={styles.backButtonLargeText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      <Stack.Screen
        options={{
          title: "",
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: "#111",
          },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={shareArticle} style={styles.headerIconButton}>
                <Ionicons name="share-social-outline" size={22} color="#fff" />
              </Pressable>

              <Pressable
                onPress={handleToggleSaved}
                style={styles.headerIconButton}
                disabled={isSaving}
              >
                <Ionicons
                  name={isSaved ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color="#fff"
                />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        removeClippedSubviews
      >
        {post.image ? (
          <View>
            <Image
              source={{ uri: post.image }}
              style={styles.heroImage}
              contentFit="cover"
              transition={250}
              cachePolicy="memory-disk"
            />

            {post.imageCaption ? (
              <Text style={styles.imageCaption}>{post.imageCaption}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.articleCard}>
          <View style={styles.metaRow}>
            {post.category ? (
              <Text style={styles.category}>{post.category}</Text>
            ) : null}

            {post.date ? (
              <Text style={styles.date}>{formatDisplayDate(post.date)}</Text>
            ) : null}
          </View>

          <Text style={styles.title}>{post.title}</Text>

          <View style={styles.divider} />

          <RotatingAdSlot placement="article-top" />

          {articleBlocks.length > 0 ? (
            articleBlocks.map((block, index) => (
              <ArticleContentBlock
                key={`${block.type}-${index}`}
                block={block}
                index={index}
                totalBlocks={articleBlocks.length}
              />
            ))
          ) : (
            <Text style={styles.body}>No article text available.</Text>
          )}

          {relatedPosts.length > 0 ? (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>Related Stories</Text>

              {relatedPosts.map((relatedPost) => (
                <RelatedStoryCard
                  key={String(relatedPost.id)}
                  post={relatedPost}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.actionButton,
                isSaved ? styles.savedButton : styles.unsavedButton,
              ]}
              onPress={handleToggleSaved}
              disabled={isSaving}
            >
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={18}
                color="#fff"
              />

              <Text style={styles.actionButtonText}>
                {isSaved ? "Saved" : "Save"}
              </Text>
            </Pressable>

            <Pressable style={styles.shareButton} onPress={shareArticle}>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Share</Text>
            </Pressable>
          </View>
        </View>
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
  container: {
    backgroundColor: "#f6f6f6",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flex: 1,
  },
  content: {
    paddingBottom: 36,
  },
  centerText: {
    color: "#666",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  notFoundTitle: {
    color: "#111",
    fontSize: 26,
    fontWeight: "900",
  },
  backButtonLarge: {
    backgroundColor: "#b00020",
    borderRadius: 14,
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonLargeText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    marginRight: 6,
  },
  headerIconButton: {
    marginLeft: 14,
  },
  heroImage: {
    backgroundColor: "#ddd",
    height: 260,
    width: "100%",
  },
  imageCaption: {
    backgroundColor: "#eeeeee",
    color: "#555",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  articleCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  category: {
    color: "#b00020",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  date: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    color: "#111",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.4,
    lineHeight: 38,
  },
  divider: {
    backgroundColor: "#e4e4e4",
    height: 1,
    marginVertical: 22,
    width: "100%",
  },
  body: {
    color: "#222",
    fontSize: 18,
    lineHeight: 31,
    marginBottom: 24,
  },
  youtubeContainer: {
    marginBottom: 24,
  },
  youtubeWrapper: {
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  youtubeWebView: {
    backgroundColor: "#000",
    flex: 1,
  },
  youtubeFallbackButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#b00020",
    borderRadius: 999,
    flexDirection: "row",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  youtubeFallbackText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 7,
  },
  relatedSection: {
    marginTop: 16,
  },
  relatedTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 16,
  },
  relatedCard: {
    backgroundColor: "#f7f7f7",
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  relatedImage: {
    height: 180,
    width: "100%",
  },
  relatedContent: {
    padding: 14,
  },
  relatedCategory: {
    color: "#b00020",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  relatedHeadline: {
    color: "#111",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    marginRight: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  savedButton: {
    backgroundColor: "#b00020",
  },
  unsavedButton: {
    backgroundColor: "#444",
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: "#1f6ed4",
    borderRadius: 999,
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 8,
  },
});