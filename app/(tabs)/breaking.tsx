import PostFeed from "../../components/PostFeed";
import { getBreakingStories } from "../../services/api";

export default function BreakingScreen() {
  return (
    <PostFeed
      title="Breaking News"
      emptyTitle="No active breaking news."
      emptyText="Breaking stories will appear here when posted within the last 72 hours."
      loadingMessage="Checking for breaking news..."
      showAds={false}
      loadPosts={getBreakingStories}
    />
  );
}