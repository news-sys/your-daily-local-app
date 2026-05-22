import PostFeed from "@/components/PostFeed";
import { getPostsByCategory } from "@/services/api";

export default function NewsTab() {
  return (
    <PostFeed
      title="Latest News"
      fetchPosts={(page = 1) => getPostsByCategory("News", page)}
      emptyMessage="No news stories available."
      showAds
    />
  );
}