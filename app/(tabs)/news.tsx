import PostFeed from "../../components/PostFeed";
import { getNewsStories } from "../../services/api";

export default function NewsScreen() {
  return (
    <PostFeed
      title="News"
      emptyTitle="No news stories right now."
      emptyText="Check back soon for the latest local updates."
      adLabel="News Sponsor"
      adFrequency={4}
      loadPosts={getNewsStories}
    />
  );
}