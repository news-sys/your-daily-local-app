import { USE_WORDPRESS } from "@/config/dev";
import type { PaginatedPosts, Post } from "@/types/Post";

import * as mockProvider from "./providers/mockProvider";
import * as wordpressProvider from "./providers/wordpressProvider";

const provider = USE_WORDPRESS
  ? wordpressProvider
  : mockProvider;

export async function getTopStories(
  page = 1
): Promise<PaginatedPosts> {
  return provider.getTopStories(page);
}

export async function getNewsPosts(
  page = 1
): Promise<PaginatedPosts> {
  return provider.getNewsPosts(page);
}

export async function getSportsPosts(
  page = 1
): Promise<PaginatedPosts> {
  return provider.getSportsPosts(page);
}

export async function getBreakingPosts(
  page = 1
): Promise<PaginatedPosts> {
  return provider.getBreakingPosts(page);
}

export async function getPostById(
  id: string
): Promise<Post | undefined> {
  return provider.getPostById(id);
}