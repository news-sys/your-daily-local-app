import PostFeed from "@/components/PostFeed";
import { getPostsByCategory } from "@/services/api";

export default function BreakingTab() {
  return (
    <PostFeed
      title="Breaking"
      fetchPosts={(page = 1) => getPostsByCategory("Breaking", page)}
      emptyMessage="No breaking news stories available."
      showAds={false}
    />
  );
}