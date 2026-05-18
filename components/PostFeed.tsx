import { useEffect, useState } from "react";
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
} from "react-native";
import type { Post } from "../types/Post";
import AdSlot from "./AdSlot";
import BrandHeader from "./BrandHeader";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";
import StoryCard from "./StoryCard";

type PostFeedProps = {
  title: string;
  emptyTitle: string;
  emptyText: string;
  loadingMessage?: string;
  loadPosts: () => Promise<Post[]>;
  showAds?: boolean;
  adLabel?: string;
  adFrequency?: number;
};

export default function PostFeed({
  title,
  emptyTitle,
  emptyText,
  loadingMessage,
  loadPosts,
  showAds = true,
  adLabel = "Advertisement",
  adFrequency = 4,
}: PostFeedProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);

  async function loadData() {
    try {
      setError(false);

      const data = await loadPosts();

      setPosts(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={!loading && !error ? posts : []}
      keyExtractor={(item) => item.id.toString()}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <>
          <BrandHeader />

          <Text style={styles.screenTitle}>{title}</Text>

          {loading ? <LoadingState message={loadingMessage} /> : null}

          {!loading && error ? <ErrorState onRetry={loadData} /> : null}
        </>
      }
      renderItem={({ item, index }) => (
        <>
          <StoryCard
            id={item.id}
            title={item.title}
            excerpt={item.excerpt}
            image={item.image}
            category={item.category}
          />

          {showAds && (index + 1) % adFrequency === 0 ? (
            <AdSlot label={adLabel} />
          ) : null}
        </>
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <EmptyState title={emptyTitle} message={emptyText} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111111",
    marginTop: 12,
    marginBottom: 16,
  },
});