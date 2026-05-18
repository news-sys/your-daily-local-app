import PostFeed from "@/components/PostFeed";
import { getNewsPosts } from "@/services/api";

export default function NewsScreen() {
  return (
    <PostFeed
      title="News"
      fetchPosts={getNewsPosts}
      emptyMessage="No news stories available."
      showAds
    />
  );
}