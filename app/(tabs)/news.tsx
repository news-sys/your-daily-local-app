import PostFeed from "@/components/PostFeed";
import { getPostsByCategory } from "@/services/api";
import type { ContentRequestOptions } from "@/types/Post";

export default function NewsTab() {
  return (
    <PostFeed
      title="Latest News"
      analyticsScreenName="news"
      fetchPosts={(
        page = 1,
        options?: ContentRequestOptions
      ) =>
        getPostsByCategory(
          "News",
          page,
          options
        )
      }
      emptyMessage="No news stories available."
      showAds
    />
  );
}