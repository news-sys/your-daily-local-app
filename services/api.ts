import { DEV_CONFIG } from "@/config/dev";
import type { HomeSection } from "@/types/HomeSection";
import type {
  ContentRequestOptions,
  PaginatedPosts,
  Post,
} from "@/types/Post";

import * as mockProvider from "./providers/mockProvider";
import * as wordpressProvider from "./providers/wordpressProvider";

const useMockProvider =
  DEV_CONFIG.dataProvider === "mock";

export async function getTopStories(
  page = 1
): Promise<PaginatedPosts> {
  if (useMockProvider) {
    return mockProvider.getTopStories(page);
  }

  return wordpressProvider.getTopStories(page);
}

export async function getNewsPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  if (useMockProvider) {
    return mockProvider.getNewsPosts(page);
  }

  return wordpressProvider.getNewsPosts(
    page,
    options
  );
}

export async function getSportsPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  if (useMockProvider) {
    return mockProvider.getSportsPosts(page);
  }

  return wordpressProvider.getSportsPosts(
    page,
    options
  );
}

export async function getBreakingPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  if (useMockProvider) {
    return mockProvider.getBreakingPosts(page);
  }

  return wordpressProvider.getBreakingPosts(
    page,
    options
  );
}

export async function getLiveVideoPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  return wordpressProvider.getLiveVideoPosts(
    page,
    options
  );
}

export async function getPostsByCategory(
  category: string,
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  if (useMockProvider) {
    return mockProvider.getPostsByCategory(
      category,
      page
    );
  }

  return wordpressProvider.getPostsByCategory(
    category,
    page,
    options
  );
}

export async function getHomepageSections(
  options: ContentRequestOptions = {}
): Promise<HomeSection[]> {
  if (useMockProvider) {
    return mockProvider.getHomepageSections();
  }

  return wordpressProvider.getHomepageSections(
    options
  );
}

export async function getPostById(
  id: string,
  options: ContentRequestOptions = {}
): Promise<Post | undefined> {
  if (useMockProvider) {
    return mockProvider.getPostById(id);
  }

  return wordpressProvider.getPostById(
    id,
    options
  );
}

export async function searchPosts(
  query: string,
  page = 1
): Promise<PaginatedPosts> {
  if (useMockProvider) {
    return mockProvider.searchPosts(
      query,
      page
    );
  }

  return wordpressProvider.searchPosts(
    query,
    page
  );
}