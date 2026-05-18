import type { Post } from "@/types/Post";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "ydl_posts_cache:";
const DEFAULT_TTL_MS = 1000 * 60 * 15; // 15 minutes

type CachedPosts = {
  savedAt: number;
  posts: Post[];
};

export async function savePostCache(key: string, posts: Post[]) {
  const payload: CachedPosts = {
    savedAt: Date.now(),
    posts,
  };

  await AsyncStorage.setItem(
    `${CACHE_PREFIX}${key}`,
    JSON.stringify(payload)
  );
}

export async function getPostCache(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<Post[] | null> {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);

  if (!raw) return null;

  try {
    const cached: CachedPosts = JSON.parse(raw);
    const isExpired = Date.now() - cached.savedAt > ttlMs;

    if (isExpired) return null;

    return cached.posts;
  } catch {
    return null;
  }
}

export async function getStalePostCache(key: string): Promise<Post[] | null> {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);

  if (!raw) return null;

  try {
    const cached: CachedPosts = JSON.parse(raw);
    return cached.posts;
  } catch {
    return null;
  }
}

export async function clearPostCache(key?: string) {
  if (key) {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return;
  }

  const keys = await AsyncStorage.getAllKeys();
  const postCacheKeys = keys.filter((item) => item.startsWith(CACHE_PREFIX));

  if (postCacheKeys.length > 0) {
    await AsyncStorage.multiRemove(postCacheKeys);
  }
}