import PostFeed from "@/components/PostFeed";
import { getPostsByCategory } from "@/services/api";
import type { ContentRequestOptions } from "@/types/Post";

export default function SportsTab() {
  return (
    <PostFeed
      title="Sports"
      analyticsScreenName="sports"
      fetchPosts={(
        page = 1,
        options?: ContentRequestOptions
      ) =>
        getPostsByCategory(
          "Sports",
          page,
          options
        )
      }
      emptyMessage="No sports stories available."
      showAds
    />
  );
}