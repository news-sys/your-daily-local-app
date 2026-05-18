import { Image } from "expo-image";
import { router } from "expo-router";
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

import type { Post } from "@/types/Post";

type PostFeedProps = {
  fetchPosts: () => Promise<Post[]>;
  title?: string;
  emptyMessage?: string;
  showAds?: boolean;
};

type FeedItem =
  | { type: "post"; post: Post }
  | { type: "ad"; id: string };

function buildFeedItems(posts: Post[], showAds: boolean): FeedItem[] {
  if (!showAds) {
    return posts.map((post) => ({ type: "post", post }));
  }

  const items: FeedItem[] = [];

  posts.forEach((post, index) => {
    items.push({ type: "post", post });

    if ((index + 1) % 3 === 0 && index !== posts.length - 1) {
      items.push({
        type: "ad",
        id: `ad-${index}`,
      });
    }
  });

  return items;
}

export default function PostFeed({
  fetchPosts,
  title = "Your Daily Local",
  emptyMessage = "No stories available.",
  showAds = true,
}: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPosts = useCallback(
    async (refreshing = false) => {
      try {
        refreshing ? setIsRefreshing(true) : setIsLoading(true);

        setErrorMessage(null);

        const nextPosts = await fetchPosts();
        setPosts(nextPosts);
      } catch {
        setErrorMessage("Unable to load stories. Pull down to try again.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchPosts]
  );

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const feedItems = buildFeedItems(posts, showAds);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />

        <View style={styles.centerState}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading stories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <FlatList
        style={styles.container}
        data={feedItems}
        keyExtractor={(item) =>
          item.type === "post" ? String(item.post.id) : item.id
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadPosts(true)}
          />
        }
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
        ListEmptyComponent={
          <View style={styles.centerState}>
            <Text style={styles.centerText}>{emptyMessage}</Text>
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

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/article",
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

              <View style={styles.cardBody}>
                {post.category ? (
                  <Text style={styles.category}>{post.category}</Text>
                ) : null}

                <Text style={styles.title}>{post.title}</Text>

                {post.excerpt ? (
                  <Text style={styles.excerpt}>{post.excerpt}</Text>
                ) : null}

                {post.date ? (
                  <Text style={styles.date}>{post.date}</Text>
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
    backgroundColor: "#f6f6f6",
    flex: 1,
  },
  container: {
    backgroundColor: "#f6f6f6",
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
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