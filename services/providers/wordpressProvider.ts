import AsyncStorage from "@react-native-async-storage/async-storage";

import type { HomeSection } from "@/types/HomeSection";
import type { PaginatedPosts, Post } from "@/types/Post";

const WORDPRESS_BASE_URL = "https://yourdailylocal.com/wp-json/wp/v2";

const CATEGORY_IDS = {
  news: 30,
  sports: 31,
  breaking: 53,
};

const CATEGORY_SLUGS = {
  forestCountyNews: "forestcountynews",
};

const PAGE_SIZE = 5;
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const BREAKING_WINDOW_HOURS = 48;
const STORAGE_CACHE_PREFIX = "ydl_wp_cache_";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

type WordPressCategory = {
  id: number;
  name: string;
  slug: string;
};

type WordPressPost = {
  id: number;
  date: string;
  sticky?: boolean;
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

function stripHtml(html = ""): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .trim();
}

function isPostWithinHours(post: Post, hours: number): boolean {
  const postTime = new Date(post.date).getTime();

  if (Number.isNaN(postTime)) return false;

  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  return postTime >= cutoff;
}

function getCategoryName(categories: number[]): string {
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

function setCached<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

async function getPersistentCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_CACHE_PREFIX}${key}`);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    const isFresh = Date.now() - parsed.timestamp < CACHE_TTL_MS;

    if (!isFresh) {
      await AsyncStorage.removeItem(`${STORAGE_CACHE_PREFIX}${key}`);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

async function setPersistentCached<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_CACHE_PREFIX}${key}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Cache write failures should not block the app.
  }
}

function paginate(posts: Post[], page: number): PaginatedPosts {
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  return {
    posts: posts.slice(start, end),
    hasMore: end < posts.length,
    nextPage: end < posts.length ? page + 1 : null,
  };
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

async function getCategoryIdBySlug(slug: string): Promise<number | null> {
  const cacheKey = `category-slug-${slug}`;
  const cached = getCached<number | null>(cacheKey);

  if (cached !== null) return cached;

  const persistentCached = await getPersistentCached<number | null>(cacheKey);

  if (persistentCached !== null) {
    setCached(cacheKey, persistentCached);
    return persistentCached;
  }

  const url = new URL(`${WORDPRESS_BASE_URL}/categories`);
  url.searchParams.set("slug", slug);

  const response = await fetchWithTimeout(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch WordPress category: ${slug}`);
  }

  const categories = (await response.json()) as WordPressCategory[];
  const categoryId = categories[0]?.id ?? null;

  setCached(cacheKey, categoryId);
  await setPersistentCached(cacheKey, categoryId);

  return categoryId;
}

async function fetchWordPressPosts({
  categoryId,
  searchQuery,
  perPage = 20,
  sticky,
}: {
  categoryId?: number | null;
  searchQuery?: string;
  perPage?: number;
  sticky?: boolean;
} = {}): Promise<Post[]> {
  if (categoryId === null) return [];

  const cacheKey = JSON.stringify({
    type: "posts",
    categoryId,
    searchQuery,
    perPage,
    sticky,
  });

  const cached = getCached<Post[]>(cacheKey);

  if (cached) return cached;

  const persistentCached = await getPersistentCached<Post[]>(cacheKey);

  if (persistentCached) {
    setCached(cacheKey, persistentCached);
    return persistentCached;
  }

  const url = new URL(`${WORDPRESS_BASE_URL}/posts`);

  url.searchParams.set("_embed", "true");
  url.searchParams.set("per_page", String(perPage));

  if (categoryId) {
    url.searchParams.set("categories", String(categoryId));
  }

  if (searchQuery?.trim()) {
    url.searchParams.set("search", searchQuery.trim());
  }

  if (typeof sticky === "boolean") {
    url.searchParams.set("sticky", String(sticky));
  }

  const response = await fetchWithTimeout(url.toString());

  if (!response.ok) {
    throw new Error("Failed to fetch WordPress posts.");
  }

  const posts = (await response.json()) as WordPressPost[];
  const mappedPosts = posts.map(mapWordPressPost);

  setCached(cacheKey, mappedPosts);
  await setPersistentCached(cacheKey, mappedPosts);

  return mappedPosts;
}

async function getTopStoryPosts(): Promise<Post[]> {
  const stickyPosts = await fetchWordPressPosts({
    perPage: 1,
    sticky: true,
  });

  if (stickyPosts.length > 0) {
    return stickyPosts;
  }

  return fetchWordPressPosts({
    perPage: 1,
  });
}

export async function getTopStories(page = 1): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({ perPage: 25 });
  return paginate(posts, page);
}

export async function getNewsPosts(page = 1): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({
    categoryId: CATEGORY_IDS.news,
    perPage: 25,
  });

  return paginate(posts, page);
}

export async function getSportsPosts(page = 1): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({
    categoryId: CATEGORY_IDS.sports,
    perPage: 25,
  });

  return paginate(posts, page);
}

export async function getBreakingPosts(page = 1): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({
    categoryId: CATEGORY_IDS.breaking,
    perPage: 25,
  });

  const activeBreakingPosts = posts.filter((post) =>
    isPostWithinHours(post, BREAKING_WINDOW_HOURS)
  );

  return paginate(activeBreakingPosts, page);
}

export async function getForestCountyNewsPosts(
  page = 1
): Promise<PaginatedPosts> {
  const categoryId = await getCategoryIdBySlug(CATEGORY_SLUGS.forestCountyNews);

  const posts = await fetchWordPressPosts({
    categoryId,
    perPage: 25,
  });

  return paginate(posts, page);
}

export async function getPostsByCategory(
  category: string,
  page = 1
): Promise<PaginatedPosts> {
  const normalizedCategory = category.toLowerCase();

  if (normalizedCategory === "sports") {
    return getSportsPosts(page);
  }

  if (normalizedCategory === "breaking") {
    return getBreakingPosts(page);
  }

  if (
    normalizedCategory === "forest-county-news" ||
    normalizedCategory === "forest county news" ||
    normalizedCategory === "forestcountynews"
  ) {
    return getForestCountyNewsPosts(page);
  }

  return getNewsPosts(page);
}

export async function getHomepageSections(): Promise<HomeSection[]> {
  const forestCountyCategoryId = await getCategoryIdBySlug(
    CATEGORY_SLUGS.forestCountyNews
  );

  const [topStoryPosts, newsPosts, sportsPosts, forestCountyPosts] =
    await Promise.all([
      getTopStoryPosts(),
      fetchWordPressPosts({ categoryId: CATEGORY_IDS.news, perPage: 6 }),
      fetchWordPressPosts({ categoryId: CATEGORY_IDS.sports, perPage: 6 }),
      fetchWordPressPosts({
        categoryId: forestCountyCategoryId,
        perPage: 6,
      }),
    ]);

  return [
    {
      id: "top-story",
      title: "Top Story",
      slug: "top-story",
      type: "lead",
      category: "featured",
      posts: topStoryPosts.slice(0, 1),
    },
    {
      id: "latest-news",
      title: "Latest News",
      slug: "latest-news",
      type: "list",
      category: "News",
      posts: newsPosts.slice(0, 4),
    },
    {
      id: "ad-1",
      title: "Advertisement",
      slug: "ad-1",
      type: "ad",
      posts: [],
    },
    {
      id: "sports",
      title: "Sports",
      slug: "sports",
      type: "list",
      category: "Sports",
      posts: sportsPosts.slice(0, 4),
    },
    {
      id: "forest-county-news",
      title: "Forest County News",
      slug: "forest-county-news",
      type: "list",
      category: "Forest County News",
      posts: forestCountyPosts.slice(0, 3),
    },
  ];
}

export async function getPostById(id: string): Promise<Post | undefined> {
  const cacheKey = `post-${id}`;
  const cached = getCached<Post | undefined>(cacheKey);

  if (cached) return cached;

  const persistentCached = await getPersistentCached<Post | undefined>(
    cacheKey
  );

  if (persistentCached) {
    setCached(cacheKey, persistentCached);
    return persistentCached;
  }

  const response = await fetchWithTimeout(
    `${WORDPRESS_BASE_URL}/posts/${id}?_embed=true`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch WordPress story.");
  }

  const post = (await response.json()) as WordPressPost;
  const mappedPost = mapWordPressPost(post);

  setCached(cacheKey, mappedPost);
  await setPersistentCached(cacheKey, mappedPost);

  return mappedPost;
}

export async function searchPosts(
  query: string,
  page = 1
): Promise<PaginatedPosts> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      posts: [],
      hasMore: false,
      nextPage: null,
    };
  }

  const posts = await fetchWordPressPosts({
    searchQuery: trimmedQuery,
    perPage: 25,
  });

  return paginate(posts, page);
}