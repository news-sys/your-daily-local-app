import { DEV_CONFIG } from "@/config/dev";
import type { HomeSection } from "@/types/HomeSection";
import type { PaginatedPosts, Post } from "@/types/Post";

import * as mockProvider from "./providers/mockProvider";
import * as wordpressProvider from "./providers/wordpressProvider";

const primaryProvider =
  DEV_CONFIG.dataProvider === "wordpress"
    ? wordpressProvider
    : mockProvider;

async function withFallback<T>(
  request: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await request();
  } catch {
    return fallback();
  }
}

export async function getTopStories(
  page = 1
): Promise<PaginatedPosts> {
  return withFallback(
    () => primaryProvider.getTopStories(page),
    () => mockProvider.getTopStories(page)
  );
}

export async function getNewsPosts(
  page = 1
): Promise<PaginatedPosts> {
  return withFallback(
    () => primaryProvider.getNewsPosts(page),
    () => mockProvider.getNewsPosts(page)
  );
}

export async function getSportsPosts(
  page = 1
): Promise<PaginatedPosts> {
  return withFallback(
    () => primaryProvider.getSportsPosts(page),
    () => mockProvider.getSportsPosts(page)
  );
}

export async function getBreakingPosts(
  page = 1
): Promise<PaginatedPosts> {
  return withFallback(
    () => primaryProvider.getBreakingPosts(page),
    () => mockProvider.getBreakingPosts(page)
  );
}

export async function getPostsByCategory(
  category: string,
  page = 1
): Promise<PaginatedPosts> {
  return withFallback(
    () => primaryProvider.getPostsByCategory(category, page),
    () => mockProvider.getPostsByCategory(category, page)
  );
}

export async function getHomepageSections(): Promise<HomeSection[]> {
  return withFallback(
    () => primaryProvider.getHomepageSections(),
    () => mockProvider.getHomepageSections()
  );
}

export async function getPostById(
  id: string
): Promise<Post | undefined> {
  return withFallback(
    () => primaryProvider.getPostById(id),
    () => mockProvider.getPostById(id)
  );
}

export async function searchPosts(
  query: string,
  page = 1
): Promise<PaginatedPosts> {
  return withFallback(
    () => primaryProvider.searchPosts(query, page),
    () => mockProvider.searchPosts(query, page)
  );
}