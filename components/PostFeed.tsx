import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSavedPosts, toggleSavedPost } from "@/services/savedPosts";
import type { PaginatedPosts, Post } from "@/types/Post";

type PostFeedProps = {
  fetchPosts: (page?: number) => Promise<PaginatedPosts>;
  title?: string;
  emptyMessage?: string;
  showAds?: boolean;
  reloadOnFocus?: boolean;
  onRemovePost?: (post: Post) => Promise<void>;
  removePostLabel?: string;
};

type FeedItem = { type: "post"; post: Post } | { type: "ad"; id: string };

function buildFeedItems(posts: Post[], showAds: boolean): FeedItem[] {
  if (!showAds) {
    return posts.map((post) => ({ type: "post", post }));
  }

  const items: FeedItem[] = [];

  posts.forEach((post, index) => {
    items.push({ type: "post", post });

    if ((index + 1) % 3 === 0 && index !== posts.length - 1) {
      items.push({ type: "ad", id: `ad-${index}` });
    }
  });

  return items;
}

export default function PostFeed({
  fetchPosts,
  title = "Your Daily Local",
  emptyMessage = "No stories available.",
  showAds = true,
  reloadOnFocus = false,
  onRemovePost,
  removePostLabel = "Remove",
}: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<number[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [savingPostId, setSavingPostId] = useState<number | null>(null);
  const [removingPostId, setRemovingPostId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSavedStoriesFeed = title === "Saved Stories";

  const refreshSavedPostIds = useCallback(async () => {
    const savedPosts = await getSavedPosts();
    setSavedPostIds(savedPosts.map((post) => post.id));
  }, []);

  const loadFirstPage = useCallback(
    async (refreshing = false) => {
      try {
        refreshing ? setIsRefreshing(true) : setIsLoading(true);
        setErrorMessage(null);

        const [result] = await Promise.all([
          fetchPosts(1),
          refreshSavedPostIds(),
        ]);

        setPosts(result.posts);
        setHasMore(result.hasMore);
        setNextPage(result.nextPage);
      } catch {
        setErrorMessage("Unable to load stories. Pull down to try again.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchPosts, refreshSavedPostIds]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextPage || isLoadingMore || isLoading || isRefreshing) {
      return;
    }

    try {
      setIsLoadingMore(true);

      const result = await fetchPosts(nextPage);

      setPosts((currentPosts) => [...currentPosts, ...result.posts]);
      setHasMore(result.hasMore);
      setNextPage(result.nextPage);
    } catch {
      setErrorMessage("Unable to load more stories.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPosts, hasMore, nextPage, isLoadingMore, isLoading, isRefreshing]);

  const handleToggleSavedPost = useCallback(
    async (post: Post) => {
      if (savingPostId) return;

      try {
        setSavingPostId(post.id);

        const isNowSaved = await toggleSavedPost(post);

        setSavedPostIds((currentIds) => {
          if (isNowSaved) {
            return [...currentIds, post.id];
          }

          return currentIds.filter((id) => id !== post.id);
        });
      } catch {
        setErrorMessage("Unable to update saved story. Please try again.");
      } finally {
        setSavingPostId(null);
      }
    },
    [savingPostId]
  );

  const handleRemovePost = useCallback(
    async (post: Post) => {
      if (!onRemovePost || removingPostId) return;

      try {
        setRemovingPostId(post.id);
        await onRemovePost(post);

        setPosts((currentPosts) =>
          currentPosts.filter((item) => item.id !== post.id)
        );

        setSavedPostIds((currentIds) =>
          currentIds.filter((id) => id !== post.id)
        );
      } catch {
        setErrorMessage("Unable to remove story. Please try again.");
      } finally {
        setRemovingPostId(null);
      }
    },
    [onRemovePost, removingPostId]
  );

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  useFocusEffect(
    useCallback(() => {
      refreshSavedPostIds();

      if (reloadOnFocus) {
        loadFirstPage();
      }
    }, [reloadOnFocus, loadFirstPage, refreshSavedPostIds])
  );

  const feedItems = buildFeedItems(posts, showAds);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading stories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      <FlatList
        style={styles.container}
        data={feedItems}
        keyExtractor={(item) =>
          item.type === "post" ? String(item.post.id) : item.id
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadFirstPage(true)}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        contentContainerStyle={[
          styles.listContent,
          feedItems.length === 0 && styles.emptyListContent,
        ]}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.logoText}>Your Daily Local</Text>
              <Text style={styles.feedTitle}>{title}</Text>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator />
              <Text style={styles.footerText}>Loading more stories...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centerState}>
            <Ionicons name="bookmark-outline" size={38} color="#999" />

            <Text style={styles.centerText}>{emptyMessage}</Text>

            {isSavedStoriesFeed ? (
              <>
                <Text style={styles.emptySubtext}>
                  Browse stories and tap the bookmark icon to save them here.
                </Text>

                <Pressable
                  style={styles.browseButton}
                  onPress={() => router.push("/")}
                >
                  <Text style={styles.browseButtonText}>
                    Browse Latest Stories
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === "ad") {
            return (
              <View style={styles.adBox}>
                <Text style={styles.adLabel}>Advertisement</Text>
                <Text style={styles.adText}>Your business could be here</Text>
              </View>
            );
          }

          const post = item.post;
          const isSaved = savedPostIds.includes(post.id);

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/article",
                  params: { id: String(post.id) },
                })
              }
            >
              {post.image ? (
                <Image
                  source={{ uri: post.image }}
                  style={styles.image}
                  contentFit="cover"
                  transition={250}
                  cachePolicy="memory-disk"
                />
              ) : null}

              {!onRemovePost ? (
                <Pressable
                  style={styles.bookmarkButton}
                  disabled={savingPostId === post.id}
                  onPress={(event) => {
                    event.stopPropagation();
                    handleToggleSavedPost(post);
                  }}
                >
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={22}
                    color={isSaved ? "#b00020" : "#111"}
                  />
                </Pressable>
              ) : null}

              <View style={styles.cardBody}>
                {post.category ? (
                  <Text style={styles.category}>{post.category}</Text>
                ) : null}

                <Text style={styles.title}>{post.title}</Text>

                {post.excerpt ? (
                  <Text style={styles.excerpt}>{post.excerpt}</Text>
                ) : null}

                {post.date ? <Text style={styles.date}>{post.date}</Text> : null}

                {onRemovePost ? (
                  <Pressable
                    style={styles.removeButton}
                    disabled={removingPostId === post.id}
                    onPress={(event) => {
                      event.stopPropagation();
                      handleRemovePost(post);
                    }}
                  >
                    <Ionicons name="bookmark" size={16} color="#b00020" />
                    <Text style={styles.removeButtonText}>
                      {removingPostId === post.id
                        ? "Removing..."
                        : removePostLabel}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
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
  listContent: {
    padding: 16,
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
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
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
  },
  centerState: {
    alignItems: "center",
    backgroundColor: "#f6f6f6",
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
  emptySubtext: {
    color: "#777",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 280,
    textAlign: "center",
  },
  browseButton: {
    backgroundColor: "#b00020",
    borderRadius: 999,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  browseButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
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
    fontWeight: "600",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  image: {
    backgroundColor: "#ddd",
    height: 190,
    width: "100%",
  },
  bookmarkButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 12,
    width: 40,
    zIndex: 2,
  },
  cardBody: {
    padding: 14,
  },
  category: {
    color: "#b00020",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  title: {
    color: "#111",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
  },
  excerpt: {
    color: "#555",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  date: {
    color: "#888",
    fontSize: 12,
    marginTop: 10,
  },
  removeButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#b00020",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  removeButtonText: {
    color: "#b00020",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6,
  },
  footerLoader: {
    alignItems: "center",
    paddingVertical: 18,
  },
  footerText: {
    color: "#666",
    fontSize: 13,
    marginTop: 8,
  },
  adBox: {
    alignItems: "center",
    backgroundColor: "#f3f3f3",
    borderColor: "#ddd",
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  adLabel: {
    color: "#777",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  adText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "700",
  },
});