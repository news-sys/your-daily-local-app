import PostFeed from "@/components/PostFeed";
import { getPostsByCategory } from "@/services/api";

export default function SportsTab() {
  return (
    <PostFeed
      title="Sports"
      fetchPosts={(page = 1) => getPostsByCategory("Sports", page)}
      emptyMessage="No sports stories available."
      showAds
    />
  );
}