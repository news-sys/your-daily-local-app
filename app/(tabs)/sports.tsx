import PostFeed from "@/components/PostFeed";
import { getSportsPosts } from "@/services/api";

export default function SportsScreen() {
  return (
    <PostFeed
      title="Sports"
      fetchPosts={getSportsPosts}
      emptyMessage="No sports stories available."
      showAds
    />
  );
}