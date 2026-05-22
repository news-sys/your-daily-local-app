import { useLocalSearchParams } from "expo-router";

import PostFeed from "@/components/PostFeed";
import { getPostsByCategory } from "@/services/api";

const CATEGORY_LABELS: Record<string, string> = {
  "latest-news": "Latest News",
  news: "Latest News",
  sports: "Sports",
  breaking: "Breaking",
  "forest-county-news": "Forest County News",
};

const CATEGORY_MAP: Record<string, string> = {
  "latest-news": "News",
  news: "News",
  sports: "Sports",
  breaking: "Breaking",
  "forest-county-news": "Forest County News",
};

export default function CategoryScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = params.slug ?? "news";

  const title = CATEGORY_LABELS[slug] ?? "Stories";
  const category = CATEGORY_MAP[slug] ?? slug;

  return (
    <PostFeed
      title={title}
      fetchPosts={(page = 1) => getPostsByCategory(category, page)}
      emptyMessage={`No ${title.toLowerCase()} stories available.`}
      showAds
    />
  );
}