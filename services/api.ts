import { USE_WORDPRESS } from "@/config/dev";
import type { Post } from "@/types/Post";

import * as mockProvider from "./providers/mockProvider";
import * as wordpressProvider from "./providers/wordpressProvider";

import {
    getPostCache,
    getStalePostCache,
    savePostCache,
} from "./postCache";

const provider = USE_WORDPRESS
  ? wordpressProvider
  : mockProvider;

const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

async function fetchWithCache(
  cacheKey: string,
  fetcher: () => Promise<Post[]>
): Promise<Post[]> {
  // 1. Fresh cache
  const cached = await getPostCache(cacheKey, CACHE_TTL);

  if (cached && cached.length > 0) {
    console.log(`[CACHE HIT] ${cacheKey}`);
    return cached;
  }

  try {
    // 2. Network/provider fetch
    console.log(`[FETCH] ${cacheKey}`);

    const posts = await fetcher();

    if (posts?.length) {
      await savePostCache(cacheKey, posts);
    }

    return posts;
  } catch (error) {
    console.error(`[FETCH ERROR] ${cacheKey}`, error);

    // 3. Stale fallback cache
    const stale = await getStalePostCache(cacheKey);

    if (stale && stale.length > 0) {
      console.log(`[STALE CACHE FALLBACK] ${cacheKey}`);
      return stale;
    }

    throw error;
  }
}

export async function getTopStories(): Promise<Post[]> {
  return fetchWithCache("top-stories", () =>
    provider.getTopStories()
  );
}

export async function getNewsPosts(): Promise<Post[]> {
  return fetchWithCache("news-posts", () =>
    provider.getNewsPosts()
  );
}

export async function getSportsPosts(): Promise<Post[]> {
  return fetchWithCache("sports-posts", () =>
    provider.getSportsPosts()
  );
}

export async function getBreakingPosts(): Promise<Post[]> {
  return fetchWithCache("breaking-posts", () =>
    provider.getBreakingPosts()
  );
}

export async function getPostById(
  id: string
): Promise<Post | undefined> {
  try {
    return await provider.getPostById(id);
  } catch (error) {
    console.error("[POST FETCH ERROR]", error);
    return undefined;
  }
}