import { mockPosts } from "@/data/mockPosts";
import type { PaginatedPosts, Post } from "@/types/Post";

const PAGE_SIZE = 5;

function sortNewestFirst(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

function paginate(posts: Post[], page: number): PaginatedPosts {
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const paginatedPosts = posts.slice(start, end);

  return {
    posts: paginatedPosts,
    hasMore: end < posts.length,
    nextPage: end < posts.length ? page + 1 : null,
  };
}

function filterByCategory(category: string): Post[] {
  return sortNewestFirst(
    mockPosts.filter(
      (post) =>
        post.category.toLowerCase() === category.toLowerCase()
    )
  );
}

export async function getTopStories(
  page = 1
): Promise<PaginatedPosts> {
  return paginate(sortNewestFirst(mockPosts), page);
}

export async function getNewsPosts(
  page = 1
): Promise<PaginatedPosts> {
  return paginate(filterByCategory("News"), page);
}

export async function getSportsPosts(
  page = 1
): Promise<PaginatedPosts> {
  return paginate(filterByCategory("Sports"), page);
}

export async function getBreakingPosts(
  page = 1
): Promise<PaginatedPosts> {
  return paginate(filterByCategory("Breaking"), page);
}

export async function getPostById(
  id: string
): Promise<Post | undefined> {
  return mockPosts.find((post) => String(post.id) === id);
}