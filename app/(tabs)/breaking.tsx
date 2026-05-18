import PostFeed from "@/components/PostFeed";
import { getBreakingPosts } from "@/services/api";

export default function BreakingScreen() {
  return (
    <PostFeed
      title="Breaking"
      fetchPosts={getBreakingPosts}
      emptyMessage="No breaking news stories available."
      showAds={false}
    />
  );
}