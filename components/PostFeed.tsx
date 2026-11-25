
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
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import RotatingAdSlot from "@/components/RotatingAdSlot";
import type {
  AdPlacementRule,
  AdRuleSurface,
  LegacyAdPlacement,
} from "@/data/adSlots";
import { getFeedPlacementRules } from "@/services/ads";
import { trackEvent, trackScreenView } from "@/services/analytics";
import {
  getSavedPosts,
  toggleSavedPost,
} from "@/services/savedPosts";
import type {
  ContentRequestOptions,
  PaginatedPosts,
  Post,
} from "@/types/Post";
import { formatDisplayDate } from "@/utils/formatDisplayDate";

const DEFAULT_FOCUS_REFRESH_MS = 60 * 1000;
const BREAKING_FOCUS_REFRESH_MS = 30 * 1000;
const BACK_TO_TOP_THRESHOLD = 700;

type PostFeedProps = {
  fetchPosts: (
    page?: number,
    options?: ContentRequestOptions
  ) => Promise<PaginatedPosts>;
  analyticsScreenName?: string;
  title?: string;
  emptyMessage?: string;
  showAds?: boolean;
  reloadOnFocus?: boolean;
  onRemovePost?: (post: Post) => Promise<void>;
  removePostLabel?: string;
};

type FeedItem =
  | { type: "post"; post: Post }
  | {
      type: "ad";
      id: string;
      legacyPlacement?: LegacyAdPlacement;
      rotationSlug?: string;
      trackingPlacement: string;
      rotationIntervalMs?: number;
    };

type LoadMode = "initial" | "manual" | "background";

function getFeedSurface(
  analyticsScreenName: string | undefined,
  title: string
): AdRuleSurface | null {
  const value = [analyticsScreenName ?? "", title]
    .join(" ")
    .trim()
    .toLowerCase();

  if (value.includes("forest")) return "forest-county-news";
  if (value.includes("breaking")) return "breaking";
  if (value.includes("sports")) return "sports";

  if (
    value.includes("watch") ||
    value.includes("live video") ||
    value.includes("live-video")
  ) {
    return "watch";
  }

  if (value.includes("saved")) return "saved";
  if (value.includes("search")) return "search";
  if (value.includes("news")) return "news";

  return null;
}

function buildLegacyFeedItems(posts: Post[]): FeedItem[] {
  const items: FeedItem[] = [];

  posts.forEach((post, index) => {
    items.push({ type: "post", post });

    if (index === 0 && posts.length > 1) {
      items.push({
        type: "ad",
        id: "legacy-presenting-feed-ad",
        legacyPlacement: "presenting-feed",
        trackingPlacement: "presenting-feed",
      });
    }

    if (index === 4 && posts.length > 5) {
      items.push({
        type: "ad",
        id: "legacy-rotation-feed-ad",
        legacyPlacement: "legacy-rotation",
        trackingPlacement: "legacy-rotation",
      });
    }
  });

  return items;
}

function buildDynamicFeedItems(
  posts: Post[],
  rules: AdPlacementRule[]
): FeedItem[] {
  const items: FeedItem[] = [];

  posts.forEach((post, index) => {
    items.push({ type: "post", post });

    const storyNumber = index + 1;

    const matchingRules = rules.filter(
      (rule) =>
        rule.feedPosition?.type === "after-story" &&
        rule.feedPosition.storyNumber === storyNumber &&
        Boolean(rule.rotationKey)
    );

    matchingRules.forEach((rule) => {
      if (!rule.rotationKey) return;

      items.push({
        type: "ad",
        id: `dynamic-feed-ad-${rule.id}-${storyNumber}`,
        rotationSlug: rule.rotationKey,
        trackingPlacement: rule.key,
        rotationIntervalMs: rule.rotationIntervalMs,
      });
    });
  });

  return items;
}

function buildFeedItems(
  posts: Post[],
  showAds: boolean,
  rules: AdPlacementRule[]
): FeedItem[] {
  if (!showAds) {
    return posts.map((post) => ({
      type: "post",
      post,
    }));
  }

  if (rules.length > 0) {
    return buildDynamicFeedItems(posts, rules);
  }

  return buildLegacyFeedItems(posts);
}

function getFocusRefreshInterval(
  analyticsScreenName: string | undefined,
  title: string
): number {
  const label = [analyticsScreenName ?? "", title]
    .join(" ")
    .toLowerCase();

  return label.includes("breaking")
    ? BREAKING_FOCUS_REFRESH_MS
    : DEFAULT_FOCUS_REFRESH_MS;
}

function postHasChanged(
  currentPost: Post,
  nextPost: Post
): boolean {
  return (
    currentPost.id !== nextPost.id ||
    currentPost.title !== nextPost.title ||
    currentPost.excerpt !== nextPost.excerpt ||
    currentPost.date !== nextPost.date ||
    currentPost.modified !== nextPost.modified ||
    currentPost.image !== nextPost.image ||
    currentPost.category !== nextPost.category
  );
}

function postListsAreEqual(
  currentPosts: Post[],
  nextPosts: Post[]
): boolean {
  if (currentPosts.length !== nextPosts.length) {
    return false;
  }

  return currentPosts.every((currentPost, index) => {
    const nextPost = nextPosts[index];

    return Boolean(
      nextPost && !postHasChanged(currentPost, nextPost)
    );
  });
}

function mergeBackgroundFirstPage(
  currentPosts: Post[],
  refreshedPosts: Post[]
): Post[] {
  // An empty refresh must not wipe a working feed.
  if (refreshedPosts.length === 0 && currentPosts.length > 0) {
    return currentPosts;
  }

  if (currentPosts.length === 0) {
    return refreshedPosts;
  }

  const refreshedIds = new Set(
    refreshedPosts.map((post) => post.id)
  );

  const existingRemainder = currentPosts.filter(
    (post) => !refreshedIds.has(post.id)
  );

  return [...refreshedPosts, ...existingRemainder];
}

type FeedPostCardProps = {
  post: Post;
  isSaved: boolean;
  isSaving: boolean;
  isRemoving: boolean;
  showBookmarkButton: boolean;
  removePostLabel: string;
  analyticsScreenName?: string;
  onToggleSavedPost: (post: Post) => Promise<void>;
  onRemovePost?: (post: Post) => Promise<void>;
};

const FeedAdSlot = memo(function FeedAdSlot({
  legacyPlacement,
  rotationSlug,
  trackingPlacement,
  rotationIntervalMs,
}: {
  legacyPlacement?: LegacyAdPlacement;
  rotationSlug?: string;
  trackingPlacement: string;
  rotationIntervalMs?: number;
}) {
  if (rotationSlug) {
    return (
      <RotatingAdSlot
        rotationSlug={rotationSlug}
        trackingPlacement={trackingPlacement}
        rotationIntervalMs={rotationIntervalMs}
      />
    );
  }

  if (legacyPlacement) {
    return <RotatingAdSlot placement={legacyPlacement} />;
  }

  return null;
});

const FeedPostCard = memo(function FeedPostCard({
  post,
  isSaved,
  isSaving,
  isRemoving,
  showBookmarkButton,
  removePostLabel,
  analyticsScreenName,
  onToggleSavedPost,
  onRemovePost,
}: FeedPostCardProps) {
  const openArticle = useCallback(() => {
    trackEvent("article_open", {
      source: analyticsScreenName ?? "feed",
      postId: post.id,
      title: post.title,
    });

    router.push({
      pathname: "/(tabs)/article",
      params: { id: String(post.id) },
    });
  }, [analyticsScreenName, post.id, post.title]);

  const handleBookmarkPress = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      void onToggleSavedPost(post);
    },
    [onToggleSavedPost, post]
  );

  const handleRemovePress = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();

      if (onRemovePost) {
        void onRemovePost(post);
      }
    },
    [onRemovePost, post]
  );

  return (
    <Pressable style={styles.card} onPress={openArticle}>
      {post.image ? (
        <Image
          source={{ uri: post.image }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={String(post.id)}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons
            name="newspaper-outline"
            size={34}
            color="#999"
          />
        </View>
      )}

      {showBookmarkButton ? (
        <Pressable
          style={styles.bookmarkButton}
          disabled={isSaving}
          onPress={handleBookmarkPress}
        >
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={22}
            color={isSaved ? "#b00020" : "#111"}
          />
        </Pressable>
      ) : null}

      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          {post.category ? (
            <Text style={styles.category}>
              {post.category}
            </Text>
          ) : null}

          {post.date ? (
            <Text style={styles.date}>
              {formatDisplayDate(post.date)}
            </Text>
          ) : null}
        </View>

        <Text style={styles.title}>{post.title}</Text>

        {post.excerpt ? (
          <Text style={styles.excerpt}>
            {post.excerpt}
          </Text>
        ) : null}

        {onRemovePost ? (
          <Pressable
            style={styles.removeButton}
            disabled={isRemoving}
            onPress={handleRemovePress}
          >
            <Ionicons
              name="bookmark"
              size={16}
              color="#b00020"
            />
            <Text style={styles.removeButtonText}>
              {isRemoving ? "Removing..." : removePostLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

export default function PostFeed({
  fetchPosts,
  analyticsScreenName,
  title = "Your Daily Local",
  emptyMessage = "No stories available.",
  showAds = true,
  reloadOnFocus = false,
  onRemovePost,
  removePostLabel = "Remove",
}: PostFeedProps) {
  const listRef = useRef<FlatList<FeedItem>>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<number[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [savingPostId, setSavingPostId] = useState<number | null>(
    null
  );
  const [removingPostId, setRemovingPostId] = useState<
    number | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [adRules, setAdRules] = useState<AdPlacementRule[]>([]);

  const isSavedStoriesFeed = title === "Saved Stories";

  const feedSurface = useMemo(
    () => getFeedSurface(analyticsScreenName, title),
    [analyticsScreenName, title]
  );

  const postsRef = useRef<Post[]>([]);
  const isLoadingRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const isLoadingAdRulesRef = useRef(false);
  const hasReceivedInitialFocusRef = useRef(false);
  const hasCompletedInitialLoadRef = useRef(false);
  const lastRefreshRef = useRef(0);

  const focusRefreshInterval = useMemo(
    () => getFocusRefreshInterval(analyticsScreenName, title),
    [analyticsScreenName, title]
  );

  const updatePosts = useCallback((nextPosts: Post[]) => {
    postsRef.current = nextPosts;
    setPosts(nextPosts);
  }, []);

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
    listRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });
  }, []);

  useEffect(() => {
    if (analyticsScreenName) {
      trackScreenView(analyticsScreenName);
    }
  }, [analyticsScreenName]);

  const refreshSavedPostIds = useCallback(async () => {
    try {
      const savedPosts = await getSavedPosts();
      setSavedPostIds(savedPosts.map((post) => post.id));
    } catch {
      // A temporary storage failure should not erase
      // the bookmark indicators already on screen.
    }
  }, []);

  const loadAdRules = useCallback(
    async (forceRefresh = false) => {
      if (
        !showAds ||
        !feedSurface ||
        isLoadingAdRulesRef.current
      ) {
        return;
      }

      isLoadingAdRulesRef.current = true;

      try {
        const rules = await getFeedPlacementRules(
          feedSurface,
          forceRefresh
        );

        setAdRules(rules);
      } catch (error) {
        console.warn(
          "[PostFeed] Unable to refresh ad placement rules:",
          error
        );
        // Keep existing rules or legacy placements.
      } finally {
        isLoadingAdRulesRef.current = false;
      }
    },
    [feedSurface, showAds]
  );

  const loadFirstPage = useCallback(
    async (mode: LoadMode = "initial") => {
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

        if (mode === "manual" && analyticsScreenName) {
          trackEvent("screen_view", {
            screenName: analyticsScreenName,
            action: "refresh",
          });
        }

        const [result] = await Promise.all([
          fetchPosts(1, { forceRefresh }),
          loadAdRules(forceRefresh),
        ]);

        const receivedPosts = result.posts;

        if (mode === "background") {
          const mergedPosts = mergeBackgroundFirstPage(
            postsRef.current,
            receivedPosts
          );

          if (
            !postListsAreEqual(postsRef.current, mergedPosts)
          ) {
            updatePosts(mergedPosts);
          }
        } else {
          // Preserve existing content if a refresh
          // unexpectedly returns an empty page.
          const keepExisting =
            receivedPosts.length === 0 &&
            postsRef.current.length > 0 &&
            !isSavedStoriesFeed;

          if (!keepExisting) {
            if (
              !postListsAreEqual(
                postsRef.current,
                receivedPosts
              )
            ) {
              updatePosts(receivedPosts);
            }

            setHasMore(result.hasMore);
            setNextPage(result.nextPage);
          }
        }

        // Successful recovery must remove stale errors.
        setErrorMessage(null);
        lastRefreshRef.current = Date.now();
        hasCompletedInitialLoadRef.current = true;

        void refreshSavedPostIds();
      } catch (error) {
        console.warn(
          "[PostFeed] Unable to refresh stories:",
          error
        );

        if (mode !== "background") {
          // Only show the feed error if there are
          // no previously loaded stories to display.
          if (postsRef.current.length === 0) {
            setErrorMessage(
              "Unable to load stories. Check your connection and pull down to try again."
            );
          }
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
    [
      analyticsScreenName,
      fetchPosts,
      isSavedStoriesFeed,
      loadAdRules,
      refreshSavedPostIds,
      updatePosts,
    ]
  );

  const loadMore = useCallback(async () => {
    if (
      !hasMore ||
      !nextPage ||
      isLoadingMoreRef.current ||
      isLoading ||
      isRefreshing ||
      isLoadingRef.current
    ) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      if (analyticsScreenName) {
        trackEvent("screen_view", {
          screenName: analyticsScreenName,
          action: "load_more",
          page: nextPage,
        });
      }

      const result = await fetchPosts(nextPage);

      const existingIds = new Set(
        postsRef.current.map((post) => post.id)
      );

      const newPosts = result.posts.filter(
        (post) => !existingIds.has(post.id)
      );

      if (newPosts.length > 0) {
        updatePosts([...postsRef.current, ...newPosts]);
      }

      setHasMore(result.hasMore);
      setNextPage(result.nextPage);
    } catch (error) {
      console.warn(
        "[PostFeed] Unable to load additional stories:",
        error
      );
      // Retain existing posts and pagination state.
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [
    analyticsScreenName,
    fetchPosts,
    hasMore,
    isLoading,
    isRefreshing,
    nextPage,
    updatePosts,
  ]);

  const handleToggleSavedPost = useCallback(
    async (post: Post) => {
      if (savingPostId !== null) return;

      try {
        setSavingPostId(post.id);

        const isNowSaved = await toggleSavedPost(post);

        if (isNowSaved) {
          trackEvent("saved_story", {
            source: analyticsScreenName ?? "feed",
            postId: post.id,
            title: post.title,
          });
        }

        setSavedPostIds((currentIds) => {
          if (isNowSaved) {
            return currentIds.includes(post.id)
              ? currentIds
              : [...currentIds, post.id];
          }

          return currentIds.filter((id) => id !== post.id);
        });

        setErrorMessage(null);
      } catch {
        setErrorMessage(
          "Unable to update saved story. Please try again."
        );
      } finally {
        setSavingPostId(null);
      }
    },
    [analyticsScreenName, savingPostId]
  );

  const handleRemovePost = useCallback(
    async (post: Post) => {
      if (!onRemovePost || removingPostId !== null) return;

      try {
        setRemovingPostId(post.id);
        await onRemovePost(post);

        updatePosts(
          postsRef.current.filter((item) => item.id !== post.id)
        );

        setSavedPostIds((currentIds) =>
          currentIds.filter((id) => id !== post.id)
        );

        setErrorMessage(null);
      } catch {
        setErrorMessage(
          "Unable to remove story. Please try again."
        );
      } finally {
        setRemovingPostId(null);
      }
    },
    [onRemovePost, removingPostId, updatePosts]
  );

  useEffect(() => {
    async function startFeed(): Promise<void> {
      await loadFirstPage("initial");

      if (!isSavedStoriesFeed) {
        void loadFirstPage("background");
      }
    }

    void startFeed();
  }, [isSavedStoriesFeed, loadFirstPage]);

  useFocusEffect(
    useCallback(() => {
      void refreshSavedPostIds();

      if (!hasReceivedInitialFocusRef.current) {
        hasReceivedInitialFocusRef.current = true;
        return;
      }

      if (!hasCompletedInitialLoadRef.current) {
        return;
      }

      if (reloadOnFocus) {
        void loadFirstPage("background");
        return;
      }

      if (isSavedStoriesFeed) return;

      const timeSinceRefresh =
        Date.now() - lastRefreshRef.current;

      if (timeSinceRefresh >= focusRefreshInterval) {
        void loadFirstPage("background");
      }
    }, [
      focusRefreshInterval,
      isSavedStoriesFeed,
      loadFirstPage,
      refreshSavedPostIds,
      reloadOnFocus,
    ])
  );

  const feedItems = useMemo(
    () => buildFeedItems(posts, showAds, adRules),
    [adRules, posts, showAds]
  );

  const keyExtractor = useCallback((item: FeedItem) => {
    return item.type === "post"
      ? String(item.post.id)
      : item.id;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.type === "ad") {
        return (
          <FeedAdSlot
            legacyPlacement={item.legacyPlacement}
            rotationSlug={item.rotationSlug}
            trackingPlacement={item.trackingPlacement}
            rotationIntervalMs={item.rotationIntervalMs}
          />
        );
      }

      const post = item.post;

      return (
        <FeedPostCard
          post={post}
          isSaved={savedPostIds.includes(post.id)}
          isSaving={savingPostId === post.id}
          isRemoving={removingPostId === post.id}
          showBookmarkButton={!onRemovePost}
          removePostLabel={removePostLabel}
          analyticsScreenName={analyticsScreenName}
          onToggleSavedPost={handleToggleSavedPost}
          onRemovePost={
            onRemovePost ? handleRemovePost : undefined
          }
        />
      );
    },
    [
      analyticsScreenName,
      handleRemovePost,
      handleToggleSavedPost,
      onRemovePost,
      removePostLabel,
      removingPostId,
      savedPostIds,
      savingPostId,
    ]
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [errorMessage, title]
  );

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isLoadingMore]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="newspaper-outline"
          size={42}
          color="#aaa"
        />
        <Text style={styles.emptyText}>
          {emptyMessage}
        </Text>
      </View>
    );
  }, [emptyMessage, isLoading]);

  if (isLoading && posts.length === 0) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right"]}
      >
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>
            Loading stories...
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

      <FlatList
        ref={listRef}
        style={styles.container}
        data={feedItems}
        keyExtractor={keyExtractor}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadFirstPage("manual")}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={100}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        contentContainerStyle={[
          styles.listContent,
          feedItems.length === 0 &&
            styles.emptyListContent,
        ]}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

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
          <Text style={styles.backToTopText}>
            Top
          </Text>
        </Pressable>
      ) : null}
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
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 18,
  },
  headerTitle: {
    color: "#111",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  centerText: {
    color: "#666",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: "#fdecec",
    borderColor: "#f4b4b4",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  errorText: {
    color: "#8a1f1f",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 18,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    backgroundColor: "#ddd",
    height: 220,
    width: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    backgroundColor: "#e5e5e5",
    height: 170,
    justifyContent: "center",
    width: "100%",
  },
  bookmarkButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 12,
    width: 40,
  },
  cardBody: {
    padding: 16,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  category: {
    color: "#b00020",
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginRight: 12,
    textTransform: "uppercase",
  },
  date: {
    color: "#888",
    fontSize: 12,
    flexShrink: 0,
  },
  title: {
    color: "#111",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  excerpt: {
    color: "#555",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
  },
  removeButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#b00020",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: "#b00020",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6,
  },
  footerLoader: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  emptyContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  emptyText: {
    color: "#777",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: "center",
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
