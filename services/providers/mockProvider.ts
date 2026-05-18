import { mockPosts } from "@/data/mockPosts";
import type { Post } from "@/types/Post";

function sortNewestFirst(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

    return bTime - aTime;
  });
}

function filterByCategory(category: string): Post[] {
  return sortNewestFirst(
    mockPosts.filter(
      (post) =>
        post.category?.toLowerCase() === category.toLowerCase()
    )
  );
}

export async function getTopStories(): Promise<Post[]> {
  return sortNewestFirst(mockPosts).slice(0, 8);
}

export async function getNewsPosts(): Promise<Post[]> {
  return filterByCategory("News");
}

export async function getSportsPosts(): Promise<Post[]> {
  return filterByCategory("Sports");
}

export async function getBreakingPosts(): Promise<Post[]> {
  return filterByCategory("Breaking");
}

export async function getPostById(
  id: string
): Promise<Post | undefined> {
  return mockPosts.find((post) => post.id === id);
}