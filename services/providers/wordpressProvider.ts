
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { HomeSection } from "@/types/HomeSection";
import type {
  ContentRequestOptions,
  PaginatedPosts,
  Post,
} from "@/types/Post";

const WORDPRESS_BASE_URL =
  "https://yourdailylocal.com/wp-json/wp/v2";

const CATEGORY_IDS = {
  news: 30,
  sports: 31,
  breaking: 53,
  liveVideo: 1135,
};

const CATEGORY_SLUGS = {
  forestCountyNews: "forestcountynews",
};

const TAG_SLUGS = {
  appTopStory: "app",
};

const PAGE_SIZE = 5;
const SEARCH_PAGE_SIZE = 20;
const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const BREAKING_WINDOW_HOURS = 48;
const STORAGE_CACHE_PREFIX = "ydl_wp_cache_";

const RETRYABLE_STATUSES = new Set([
  429,
  500,
  502,
  503,
  504,
]);

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type WordPressCategory = {
  id: number;
  name: string;
  slug: string;
};

type WordPressTag = {
  id: number;
  name: string;
  slug: string;
};

type WordPressPost = {
  id: number;
  date: string;
  modified?: string;
  link?: string;
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
  tags?: number[];
  _embedded?: {
    author?: {
      name?: string;
    }[];
    "wp:featuredmedia"?: {
      source_url?: string;
      caption?: {
        rendered?: string;
      };
    }[];
  };
};

type FetchPostsOptions = {
  categoryId?: number | null;
  tagId?: number | null;
  searchQuery?: string;
  perPage?: number;
  forceRefresh?: boolean;
};

type CachedLookup<T> = {
  data: T;
  isFresh: boolean;
} | null;

const cache = new Map<string, CacheEntry<unknown>>();

const inFlightRequests =
  new Map<string, Promise<unknown>>();

function stripHtml(html = ""): string {
  let processed = html;

  processed = processed.replace(
    /<iframe[^>]*src=["']https?:\/\/(?:www\.)?youtube\.com\/embed\/([^"']+)["'][^>]*><\/iframe>/gi,
    (_, videoId) => {
      const cleanId = String(videoId).split("?")[0];
      return `\nhttps://www.youtube.com/watch?v=${cleanId}\n`;
    }
  );

  processed = processed.replace(
    /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/shorts\/)[^\s<]+)/gi,
    "\n$1\n"
  );

  processed = processed
    .replace(/<!--more-->/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#038;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&");

  return processed.trim();
}

function isPostWithinHours(
  post: Post,
  hours: number
): boolean {
  const postTime = new Date(post.date).getTime();

  if (Number.isNaN(postTime)) {
    return false;
  }

  const cutoff =
    Date.now() - hours * 60 * 60 * 1000;

  return postTime >= cutoff;
}

function getCategoryName(
  categories: number[]
): string {
  if (categories.includes(CATEGORY_IDS.breaking)) {
    return "Breaking";
  }

  if (categories.includes(CATEGORY_IDS.sports)) {
    return "Sports";
  }

  if (categories.includes(CATEGORY_IDS.liveVideo)) {
    return "Live Video";
  }

  return "News";
}

function mapWordPressPost(
  post: WordPressPost
): Post {
  return {
    id: post.id,
    title: stripHtml(post.title.rendered),
    excerpt: stripHtml(post.excerpt.rendered),
    body: stripHtml(post.content.rendered),
    bodyHtml: post.content.rendered,
    image:
      post._embedded?.["wp:featuredmedia"]?.[0]
        ?.source_url,
    imageCaption: stripHtml(
      post._embedded?.["wp:featuredmedia"]?.[0]
        ?.caption?.rendered
    ),
    category: getCategoryName(post.categories),
    date: post.date,
    modified: post.modified,
    author: post._embedded?.author?.[0]?.name,
    link: post.link,
  };
}

function inspectCacheEntry<T>(
  entry: CacheEntry<T> | undefined
): CachedLookup<T> {
  if (!entry) {
    return null;
  }

  const age = Date.now() - entry.timestamp;

  if (age > STALE_CACHE_MAX_AGE_MS) {
    return null;
  }

  return {
    data: entry.data,
    isFresh: age < CACHE_TTL_MS,
  };
}

function getMemoryCached<T>(
  key: string
): CachedLookup<T> {
  const entry = cache.get(key) as
    | CacheEntry<T>
    | undefined;

  const result = inspectCacheEntry(entry);

  if (!result && entry) {
    cache.delete(key);
  }

  return result;
}

function setCached<T>(
  key: string,
  data: T
): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

async function getPersistentCached<T>(
  key: string
): Promise<CachedLookup<T>> {
  try {
    const raw = await AsyncStorage.getItem(
      `${STORAGE_CACHE_PREFIX}${key}`
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    const result = inspectCacheEntry(parsed);

    if (!result) {
      await AsyncStorage.removeItem(
        `${STORAGE_CACHE_PREFIX}${key}`
      );

      return null;
    }

    return result;
  } catch {
    return null;
  }
}

async function setPersistentCached<T>(
  key: string,
  data: T
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_CACHE_PREFIX}${key}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Cache failures must not block content.
  }
}

function paginate(
  posts: Post[],
  page: number
): PaginatedPosts {
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  return {
    posts: posts.slice(start, end),
    hasMore: end < posts.length,
    nextPage:
      end < posts.length ? page + 1 : null,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(
  url: string
): Promise<Response> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (
        RETRYABLE_STATUSES.has(response.status) &&
        attempt === 1
      ) {
        console.warn(
          `[WordPress] Temporary HTTP ${response.status}; retrying ${url}`
        );

        await wait(600);
        continue;
      }

      if (!response.ok) {
        console.warn(
          `[WordPress] HTTP ${response.status}: ${url}`
        );
      }

      return response;
    } catch (error) {
      console.warn(
        `[WordPress] Request ${attempt}/2 failed: ${url}`,
        error
      );

      if (attempt === 2) {
        throw error;
      }

      await wait(600);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("WordPress request failed");
}

function addCacheBuster(url: URL): void {
  url.searchParams.set(
    "_ydl_refresh",
    String(Date.now())
  );
}

function parseTotalPages(
  response: Response
): number {
  const totalPages = Number(
    response.headers.get("X-WP-TotalPages")
  );

  if (
    !Number.isFinite(totalPages) ||
    totalPages < 1
  ) {
    return 1;
  }

  return Math.floor(totalPages);
}

async function runDeduplicated<T>(
  key: string,
  request: () => Promise<T>
): Promise<T> {
  const existing = inFlightRequests.get(
    key
  ) as Promise<T> | undefined;

  if (existing) {
    return existing;
  }

  const promise = request().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);

  return promise;
}

async function getCategoryIdBySlug(
  slug: string
): Promise<number | null> {
  const cacheKey = `category-slug-${slug}`;

  const memoryCached =
    getMemoryCached<number | null>(cacheKey);

  if (memoryCached) {
    return memoryCached.data;
  }

  const persistentCached =
    await getPersistentCached<number | null>(
      cacheKey
    );

  if (persistentCached) {
    setCached(cacheKey, persistentCached.data);
    return persistentCached.data;
  }

  return runDeduplicated(cacheKey, async () => {
    const url = new URL(
      `${WORDPRESS_BASE_URL}/categories`
    );

    url.searchParams.set("slug", slug);

    const response = await fetchWithTimeout(
      url.toString()
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch WordPress category: ${slug}`
      );
    }

    const categories =
      (await response.json()) as WordPressCategory[];

    const categoryId = categories[0]?.id ?? null;

    setCached(cacheKey, categoryId);

    await setPersistentCached(
      cacheKey,
      categoryId
    );

    return categoryId;
  });
}

async function getTagIdBySlug(
  slug: string,
  forceRefresh = false
): Promise<number | null> {
  const cacheKey = `tag-slug-${slug}`;

  if (!forceRefresh) {
    const memoryCached =
      getMemoryCached<number | null>(cacheKey);

    if (memoryCached) {
      return memoryCached.data;
    }

    const persistentCached =
      await getPersistentCached<number | null>(
        cacheKey
      );

    if (persistentCached) {
      setCached(
        cacheKey,
        persistentCached.data
      );

      return persistentCached.data;
    }
  }

  return runDeduplicated(
    `${cacheKey}-${forceRefresh ? "refresh" : "normal"}`,
    async () => {
      const url = new URL(
        `${WORDPRESS_BASE_URL}/tags`
      );

      url.searchParams.set("slug", slug);

      if (forceRefresh) {
        addCacheBuster(url);
      }

      const response = await fetchWithTimeout(
        url.toString()
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch WordPress tag: ${slug}`
        );
      }

      const tags =
        (await response.json()) as WordPressTag[];

      const tagId = tags[0]?.id ?? null;

      setCached(cacheKey, tagId);

      await setPersistentCached(
        cacheKey,
        tagId
      );

      return tagId;
    }
  );
}

function createPostsCacheKey({
  categoryId,
  tagId,
  searchQuery,
  perPage,
}: FetchPostsOptions): string {
  return JSON.stringify({
    type: "posts",
    categoryId,
    tagId,
    searchQuery,
    perPage,
  });
}

async function fetchAndCachePosts(
  options: FetchPostsOptions,
  cacheKey: string
): Promise<Post[]> {
  return runDeduplicated(cacheKey, async () => {
    const {
      categoryId,
      tagId,
      searchQuery,
      perPage = 20,
      forceRefresh = false,
    } = options;

    const url = new URL(
      `${WORDPRESS_BASE_URL}/posts`
    );

    url.searchParams.set("_embed", "true");
    url.searchParams.set(
      "per_page",
      String(perPage)
    );

    if (categoryId) {
      url.searchParams.set(
        "categories",
        String(categoryId)
      );
    }

    if (tagId) {
      url.searchParams.set(
        "tags",
        String(tagId)
      );
    }

    if (searchQuery?.trim()) {
      url.searchParams.set(
        "search",
        searchQuery.trim()
      );
    }

    if (forceRefresh) {
      addCacheBuster(url);
    }

    const response = await fetchWithTimeout(
      url.toString()
    );

    if (!response.ok) {
      throw new Error(
        "Failed to fetch WordPress posts."
      );
    }

    const posts =
      (await response.json()) as WordPressPost[];

    const mappedPosts = posts.map(
      mapWordPressPost
    );

    setCached(cacheKey, mappedPosts);

    await setPersistentCached(
      cacheKey,
      mappedPosts
    );

    return mappedPosts;
  });
}

async function fetchWordPressPosts({
  categoryId,
  tagId,
  searchQuery,
  perPage = 20,
  forceRefresh = false,
}: FetchPostsOptions = {}): Promise<Post[]> {
  if (
    categoryId === null ||
    tagId === null
  ) {
    return [];
  }

  const options: FetchPostsOptions = {
    categoryId,
    tagId,
    searchQuery,
    perPage,
    forceRefresh,
  };

  const cacheKey =
    createPostsCacheKey(options);

  if (!forceRefresh) {
    const memoryCached =
      getMemoryCached<Post[]>(cacheKey);

    if (memoryCached) {
      if (!memoryCached.isFresh) {
        void fetchAndCachePosts(
          {
            ...options,
            forceRefresh: true,
          },
          cacheKey
        ).catch(() => {});
      }

      return memoryCached.data;
    }

    const persistentCached =
      await getPersistentCached<Post[]>(
        cacheKey
      );

    if (persistentCached) {
      setCached(
        cacheKey,
        persistentCached.data
      );

      if (!persistentCached.isFresh) {
        void fetchAndCachePosts(
          {
            ...options,
            forceRefresh: true,
          },
          cacheKey
        ).catch(() => {});
      }

      return persistentCached.data;
    }
  }

  try {
    return await fetchAndCachePosts(
      options,
      cacheKey
    );
  } catch (error) {
    const memoryCached =
      getMemoryCached<Post[]>(cacheKey);

    if (memoryCached) {
      return memoryCached.data;
    }

    const persistentCached =
      await getPersistentCached<Post[]>(
        cacheKey
      );

    if (persistentCached) {
      setCached(
        cacheKey,
        persistentCached.data
      );

      return persistentCached.data;
    }

    throw error;
  }
}

async function fetchSearchPage(
  query: string,
  page: number
): Promise<PaginatedPosts> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return {
      posts: [],
      hasMore: false,
      nextPage: null,
    };
  }

  const safePage = Math.max(1, page);

  const cacheKey = JSON.stringify({
    type: "search-page",
    query: normalizedQuery.toLowerCase(),
    page: safePage,
    perPage: SEARCH_PAGE_SIZE,
  });

  const memoryCached =
    getMemoryCached<PaginatedPosts>(
      cacheKey
    );

  if (memoryCached?.isFresh) {
    return memoryCached.data;
  }

  const persistentCached =
    await getPersistentCached<PaginatedPosts>(
      cacheKey
    );

  if (persistentCached?.isFresh) {
    setCached(
      cacheKey,
      persistentCached.data
    );

    return persistentCached.data;
  }

  const url = new URL(
    `${WORDPRESS_BASE_URL}/posts`
  );

  url.searchParams.set("_embed", "true");
  url.searchParams.set(
    "search",
    normalizedQuery
  );
  url.searchParams.set(
    "page",
    String(safePage)
  );
  url.searchParams.set(
    "per_page",
    String(SEARCH_PAGE_SIZE)
  );
  url.searchParams.set(
    "orderby",
    "relevance"
  );

  addCacheBuster(url);

  try {
    return await runDeduplicated(
      cacheKey,
      async () => {
        const response =
          await fetchWithTimeout(
            url.toString()
          );

        if (!response.ok) {
          if (
            response.status === 400 &&
            safePage > 1
          ) {
            return {
              posts: [],
              hasMore: false,
              nextPage: null,
            };
          }

          throw new Error(
            "Unable to search WordPress stories."
          );
        }

        const posts =
          (await response.json()) as WordPressPost[];

        const totalPages =
          parseTotalPages(response);

        const hasMore =
          safePage < totalPages;

        const result: PaginatedPosts = {
          posts: posts.map(
            mapWordPressPost
          ),
          hasMore,
          nextPage: hasMore
            ? safePage + 1
            : null,
        };

        setCached(cacheKey, result);

        await setPersistentCached(
          cacheKey,
          result
        );

        return result;
      }
    );
  } catch (error) {
    if (memoryCached) {
      return memoryCached.data;
    }

    if (persistentCached) {
      setCached(
        cacheKey,
        persistentCached.data
      );

      return persistentCached.data;
    }

    throw error;
  }
}

async function getTopStoryPosts(
  options: ContentRequestOptions = {}
): Promise<Post[]> {
  const appTopStoryTagId =
    await getTagIdBySlug(
      TAG_SLUGS.appTopStory,
      Boolean(options.forceRefresh)
    );

  if (!appTopStoryTagId) {
    return [];
  }

  const taggedPosts =
    await fetchWordPressPosts({
      tagId: appTopStoryTagId,
      perPage: 1,
      forceRefresh:
        options.forceRefresh,
    });

  return taggedPosts.slice(0, 1);
}

export async function getTopStories(
  page = 1
): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({
    perPage: 25,
  });

  return paginate(posts, page);
}

export async function getNewsPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({
    categoryId: CATEGORY_IDS.news,
    perPage: 25,
    forceRefresh:
      options.forceRefresh,
  });

  return paginate(posts, page);
}

export async function getSportsPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({
    categoryId: CATEGORY_IDS.sports,
    perPage: 25,
    forceRefresh:
      options.forceRefresh,
  });

  return paginate(posts, page);
}

export async function getBreakingPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({
    categoryId: CATEGORY_IDS.breaking,
    perPage: 25,
    forceRefresh:
      options.forceRefresh,
  });

  const activeBreakingPosts =
    posts.filter((post) =>
      isPostWithinHours(
        post,
        BREAKING_WINDOW_HOURS
      )
    );

  return paginate(
    activeBreakingPosts,
    page
  );
}

export async function getForestCountyNewsPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const categoryId =
    await getCategoryIdBySlug(
      CATEGORY_SLUGS.forestCountyNews
    );

  const posts = await fetchWordPressPosts({
    categoryId,
    perPage: 25,
    forceRefresh:
      options.forceRefresh,
  });

  return paginate(posts, page);
}

export async function getPostsByCategory(
  category: string,
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const normalizedCategory =
    category.trim().toLowerCase();

  if (normalizedCategory === "sports") {
    return getSportsPosts(
      page,
      options
    );
  }

  if (normalizedCategory === "breaking") {
    return getBreakingPosts(
      page,
      options
    );
  }

  if (normalizedCategory === "live video") {
    return getLiveVideoPosts(
      page,
      options
    );
  }

  if (
    normalizedCategory ===
      "forest-county-news" ||
    normalizedCategory ===
      "forest county news" ||
    normalizedCategory ===
      "forestcountynews"
  ) {
    return getForestCountyNewsPosts(
      page,
      options
    );
  }

  return getNewsPosts(
    page,
    options
  );
}

export async function getHomepageSections(
  options: ContentRequestOptions = {}
): Promise<HomeSection[]> {
  const forestCountyCategoryPromise =
    getCategoryIdBySlug(
      CATEGORY_SLUGS.forestCountyNews
    );

  const topStoryPromise =
    getTopStoryPosts(options);

  const newsPromise =
    fetchWordPressPosts({
      categoryId: CATEGORY_IDS.news,
      perPage: 6,
      forceRefresh:
        options.forceRefresh,
    });

  const sportsPromise =
    fetchWordPressPosts({
      categoryId: CATEGORY_IDS.sports,
      perPage: 6,
      forceRefresh:
        options.forceRefresh,
    });

  const forestCountyPromise =
    forestCountyCategoryPromise.then(
      (forestCountyCategoryId) =>
        fetchWordPressPosts({
          categoryId:
            forestCountyCategoryId,
          perPage: 6,
          forceRefresh:
            options.forceRefresh,
        })
    );

  const results = await Promise.allSettled([
    topStoryPromise,
    newsPromise,
    sportsPromise,
    forestCountyPromise,
  ]);

  const [
    topStoryPosts,
    newsPosts,
    sportsPosts,
    forestCountyPosts,
  ] = results.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : []
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `[WordPress] Home section ${index} failed`,
        result.reason
      );
    }
  });

  if (
    results.every(
      (result) =>
        result.status === "rejected"
    )
  ) {
    throw new Error(
      "All Home content sections failed"
    );
  }

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

async function fetchAndCachePostById(
  id: string,
  cacheKey: string,
  forceRefresh: boolean
): Promise<Post | undefined> {
  return runDeduplicated(
    cacheKey,
    async () => {
      const url = new URL(
        `${WORDPRESS_BASE_URL}/posts/${id}`
      );

      url.searchParams.set(
        "_embed",
        "true"
      );

      if (forceRefresh) {
        addCacheBuster(url);
      }

      const response =
        await fetchWithTimeout(
          url.toString()
        );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch WordPress story."
        );
      }

      const post =
        (await response.json()) as WordPressPost;

      const mappedPost =
        mapWordPressPost(post);

      setCached(
        cacheKey,
        mappedPost
      );

      await setPersistentCached(
        cacheKey,
        mappedPost
      );

      return mappedPost;
    }
  );
}

export async function getPostById(
  id: string,
  options: ContentRequestOptions = {}
): Promise<Post | undefined> {
  const cacheKey = `post-${id}`;

  if (!options.forceRefresh) {
    const memoryCached =
      getMemoryCached<Post | undefined>(
        cacheKey
      );

    if (memoryCached) {
      if (!memoryCached.isFresh) {
        void fetchAndCachePostById(
          id,
          cacheKey,
          true
        ).catch(() => {});
      }

      return memoryCached.data;
    }

    const persistentCached =
      await getPersistentCached<
        Post | undefined
      >(cacheKey);

    if (persistentCached) {
      setCached(
        cacheKey,
        persistentCached.data
      );

      if (!persistentCached.isFresh) {
        void fetchAndCachePostById(
          id,
          cacheKey,
          true
        ).catch(() => {});
      }

      return persistentCached.data;
    }
  }

  try {
    return await fetchAndCachePostById(
      id,
      cacheKey,
      Boolean(options.forceRefresh)
    );
  } catch (error) {
    const memoryCached =
      getMemoryCached<Post | undefined>(
        cacheKey
      );

    if (memoryCached) {
      return memoryCached.data;
    }

    const persistentCached =
      await getPersistentCached<
        Post | undefined
      >(cacheKey);

    if (persistentCached) {
      setCached(
        cacheKey,
        persistentCached.data
      );

      return persistentCached.data;
    }

    throw error;
  }
}

export async function searchPosts(
  query: string,
  page = 1
): Promise<PaginatedPosts> {
  return fetchSearchPage(
    query,
    page
  );
}

export async function getLiveVideoPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const posts = await fetchWordPressPosts({
    categoryId:
      CATEGORY_IDS.liveVideo,
    perPage: 25,
    forceRefresh:
      options.forceRefresh,
  });

  return paginate(posts, page);
}
