import { Stack, useLocalSearchParams } from "expo-router";

import PostFeed from "@/components/PostFeed";
import { getCategoryConfig } from "@/config/categories";
import { getPostsByCategory } from "@/services/api";

export default function CategoryScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const config = getCategoryConfig(params.slug);

  return (
    <>
      <Stack.Screen options={{ title: config.title }} />

      <PostFeed
        title={config.title}
        fetchPosts={(page = 1) => getPostsByCategory(config.category, page)}
        emptyMessage={`No ${config.title.toLowerCase()} stories available.`}
        showAds={config.showAds}
      />
    </>
  );
}