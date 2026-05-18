import type { Post } from "../../types/Post";

const WORDPRESS_BASE_URL = "https://yourdailylocal.com/wp-json/wp/v2";

const CATEGORY_IDS = {
  news: 30,
  sports: 31,
  breaking: 53,
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<Post[] | Post | undefined>>();

type WordPressPost = {
  id: number;
  date: string;
  title: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  categories: number[];
  _embedded?: {
    "wp:featuredmedia"?: {
      source_url?: string;
    }[];
  };
};

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function getCategoryName(categories: number[]) {
  if (categories.includes(CATEGORY_IDS.breaking)) return "Breaking";
  if (categories.includes(CATEGORY_IDS.sports)) return "Sports";

  return "News";
}

function mapWordPressPost(post: WordPressPost): Post {
  return {
    id: post.id,
    title: stripHtml(post.title.rendered),
    excerpt: stripHtml(post.excerpt.rendered),
    body: stripHtml(post.content.rendered),
    image: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
    category: getCategoryName(post.categories),
    date: post.date,
  };
}

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);

  if (!cached) return null;

  const isFresh = Date.now() - cached.timestamp < CACHE_TTL_MS;

  if (!isFresh) {
    cache.delete(key);
    return null;
  }

  return cached.data as T;
}

function setCached<T extends Post[] | Post | undefined>(
  key: string,
  data: T
) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPostsByCategory(categoryId?: number): Promise<Post[]> {
  const cacheKey = categoryId ? `category-${categoryId}` : "top-stories";
  const cached = getCached<Post[]>(cacheKey);

  if (cached) return cached;

  const url = new URL(`${WORDPRESS_BASE_URL}/posts`);

  url.searchParams.set("_embed", "true");
  url.searchParams.set("per_page", "10");

  if (categoryId) {
    url.searchParams.set("categories", categoryId.toString());
  }

  const response = await fetchWithTimeout(url.toString());

  if (!response.ok) {
    throw new Error("Failed to fetch WordPress posts.");
  }

  const posts = (await response.json()) as WordPressPost[];
  const mappedPosts = posts.map(mapWordPressPost);

  setCached(cacheKey, mappedPosts);

  return mappedPosts;
}

export async function getWordPressTopStories(): Promise<Post[]> {
  return fetchPostsByCategory();
}

export async function getWordPressNewsStories(): Promise<Post[]> {
  return fetchPostsByCategory(CATEGORY_IDS.news);
}

export async function getWordPressSportsStories(): Promise<Post[]> {
  return fetchPostsByCategory(CATEGORY_IDS.sports);
}

export async function getWordPressBreakingStories(): Promise<Post[]> {
  return fetchPostsByCategory(CATEGORY_IDS.breaking);
}

export async function getWordPressStoryById(
  id: number
): Promise<Post | undefined> {
  const cacheKey = `story-${id}`;
  const cached = getCached<Post | undefined>(cacheKey);

  if (cached) return cached;

  const response = await fetchWithTimeout(
    `${WORDPRESS_BASE_URL}/posts/${id}?_embed=true`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch WordPress story.");
  }

  const post = (await response.json()) as WordPressPost;
  const mappedPost = mapWordPressPost(post);

  setCached(cacheKey, mappedPost);

  return mappedPost;
}