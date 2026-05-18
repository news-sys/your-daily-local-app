import PostFeed from "../../components/PostFeed";
import { getSportsStories } from "../../services/api";

export default function SportsScreen() {
  return (
    <PostFeed
      title="Sports"
      emptyTitle="No sports stories right now."
      emptyText="Check back soon for the latest local sports coverage."
      loadingMessage="Loading sports coverage..."
      adLabel="Sports Sponsor"
      adFrequency={3}
      loadPosts={getSportsStories}
    />
  );
}