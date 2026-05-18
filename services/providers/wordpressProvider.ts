import type { Post } from "../../types/Post";

const WORDPRESS_BASE_URL = "https://yourdailylocal.com/wp-json/wp/v2";

export async function getWordPressTopStories(): Promise<Post[]> {
  throw new Error("WordPress provider is not enabled yet.");
}

export async function getWordPressNewsStories(): Promise<Post[]> {
  throw new Error("WordPress provider is not enabled yet.");
}

export async function getWordPressSportsStories(): Promise<Post[]> {
  throw new Error("WordPress provider is not enabled yet.");
}

export async function getWordPressBreakingStories(): Promise<Post[]> {
  throw new Error("WordPress provider is not enabled yet.");
}

export async function getWordPressStoryById(
  id: number
): Promise<Post | undefined> {
  throw new Error("WordPress provider is not enabled yet.");
}