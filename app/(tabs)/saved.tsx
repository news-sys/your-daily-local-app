import PostFeed from "@/components/PostFeed";
import { getSavedPosts, removeSavedPost } from "@/services/savedPosts";
import type { PaginatedPosts, Post } from "@/types/Post";

async function fetchSavedPosts(): Promise<PaginatedPosts> {
  const posts = await getSavedPosts();

  return {
    posts,
    hasMore: false,
    nextPage: null,
  };
}

async function handleRemoveSavedPost(post: Post): Promise<void> {
  await removeSavedPost(post.id);
}

export default function SavedScreen() {
  return (
    <PostFeed
      title="Saved Stories"
      fetchPosts={fetchSavedPosts}
      emptyMessage="No saved stories yet."
      showAds={false}
      reloadOnFocus
      onRemovePost={handleRemoveSavedPost}
      removePostLabel="Unsave"
    />
  );
}