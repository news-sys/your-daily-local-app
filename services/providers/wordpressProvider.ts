import type { HomeSection } from "@/types/HomeSection";
import type {
  ContentRequestOptions,
  PaginatedPosts,
  Post,
} from "@/types/Post";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WORDPRESS_BASE_URL =
  "https://yourdailylocal.com/wp-json/wp/v2";

const CATEGORY_IDS = {
  news: 30,
  sports: 31,
  breaking: 53,
  liveVideo: 1135,
};

const PAGE_SIZE = 5;
const SEARCH_PAGE_SIZE = 20;
const CACHE_TTL_MS = 5 * 60 * 1000;
const OFFLINE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const STORAGE_CACHE_PREFIX = "ydl_wp_cache_";
const MAX_MEMORY_ENTRIES = 200;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const POST_FIELDS =
  "id,date,modified,link,title.rendered,excerpt.rendered,content.rendered,categories,tags,_links,_embedded";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type MediaSize = {
  source_url?: string;
  width?: number;
  height?: number;
};

type WordPressPost = {
  id: number;
  date: string;
  modified?: string;
  link?: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content: { rendered: string };
  categories: number[];
  _embedded?: {
    author?: Array<{ name?: string }>;
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      caption?: { rendered?: string };
      media_details?: {
        sizes?: Record<string, MediaSize>;
      };
    }>;
  };
};

type Query = {
  categoryId?: number | null;
  tagId?: number | null;
  search?: string;
  breaking?: boolean;
};

class WordPressError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(`WordPress request failed (${status}): ${code}`);
    this.status = status;
    this.code = code;
  }
}

const memory = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const writes = new Map<string, Promise<void>>();

function remember<T>(
  key: string,
  entry: CacheEntry<T>
): void {
  memory.delete(key);
  memory.set(key, entry);

  if (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
}

function isUsable<T>(
  entry: CacheEntry<T> | undefined
): entry is CacheEntry<T> {
  return Boolean(
    entry &&
      Number.isFinite(entry.timestamp) &&
      Date.now() - entry.timestamp <=
        OFFLINE_CACHE_MAX_AGE_MS
  );
}

async function readCache<T>(
  key: string
): Promise<CacheEntry<T> | undefined> {
  const existing = memory.get(key) as
    | CacheEntry<T>
    | undefined;

  if (isUsable(existing)) return existing;

  try {
    const raw = await AsyncStorage.getItem(
      `${STORAGE_CACHE_PREFIX}${key}`
    );

    // Another request may have updated memory during the read.
    const latest = memory.get(key) as
      | CacheEntry<T>
      | undefined;

    if (isUsable(latest)) return latest;
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as CacheEntry<T>;

    if (
      !parsed ||
      !("data" in parsed) ||
      !isUsable(parsed)
    ) {
      return undefined;
    }

    // Preserve the original fetch timestamp.
    remember(key, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

function writeCache<T>(
  key: string,
  data: T,
  timestamp = Date.now()
): void {
  const entry = { data, timestamp };
  remember(key, entry);

  // Keep writes ordered without making screens wait for storage.
  const previous = writes.get(key) ?? Promise.resolve();

  const pending = previous
    .then(() =>
      AsyncStorage.setItem(
        `${STORAGE_CACHE_PREFIX}${key}`,
        JSON.stringify(entry)
      )
    )
    .catch(() => undefined);

  writes.set(key, pending);

  void pending.then(() => {
    if (writes.get(key) === pending) {
      writes.delete(key);
    }
  });
}

function deduplicated<T>(
  key: string,
  work: () => Promise<T>
): Promise<T> {
  const existing = inFlight.get(key) as
    | Promise<T>
    | undefined;

  if (existing) return existing;

  const promise = work().finally(() =>
    inFlight.delete(key)
  );

  inFlight.set(key, promise);
  return promise;
}

async function cachedRequest<T>(
  key: string,
  forceRefresh: boolean,
  work: (attempts: number) => Promise<T>
): Promise<T> {
  const cached = await readCache<T>(key);

  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.timestamp < CACHE_TTL_MS
  ) {
    return cached.data;
  }

  try {
    return await deduplicated(key, async () => {
      // Avoid an extra retry when cached content is available.
      const value = await work(cached ? 1 : 2);
      writeCache(key, value);
      return value;
    });
  } catch (error) {
    const transient =
      !(error instanceof WordPressError) ||
      RETRYABLE_STATUSES.has(error.status);

    if (cached && transient) return cached.data;

    throw error;
  }
}

async function requestJson<T>(
  url: URL,
  attempts: number,
  forceRefresh = false
): Promise<{ data: T; headers: Headers }> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: forceRefresh
          ? {
              Accept: "application/json",
              "Cache-Control": "no-cache",
            }
          : {
              Accept: "application/json",
            },
      });

      // Include the response-body read in the timeout.
      const data: unknown = await response.json();

      if (!response.ok) {
        const code =
          data &&
          typeof data === "object" &&
          "code" in data
            ? String(data.code)
            : "request_failed";

        throw new WordPressError(
          response.status,
          code
        );
      }

      return {
        data: data as T,
        headers: response.headers,
      };
    } catch (error) {
      const retryable =
        !(error instanceof WordPressError) ||
        RETRYABLE_STATUSES.has(error.status);

      if (
        !retryable ||
        attempt + 1 >= attempts
      ) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 600)
    );
  }

  throw new Error("WordPress request failed.");
}

function stripHtml(html = ""): string {
  return html
    .replace(
      /<iframe[^>]*src=["']https?:\/\/(?:www\.)?youtube\.com\/embed\/([^"']+)["'][^>]*><\/iframe>/gi,
      (_, videoId: string) =>
        `\nhttps://www.youtube.com/watch?v=${videoId.split("?")[0]}\n`
    )
    .replace(
      /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/shorts\/)[^\s<]+)/gi,
      "\n$1\n"
    )
    .replace(/<!--more-->/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;|&#039;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#038;|&amp;/g, "&")
    .trim();
}

function chooseImage(
  post: WordPressPost
): string | undefined {
  const media =
    post._embedded?.["wp:featuredmedia"]?.[0];

  const sizes = Object.values(
    media?.media_details?.sizes ?? {}
  )
    .filter(
      (size) =>
        Boolean(size.source_url) &&
        (size.width ?? 0) >= 800
    )
    .sort(
      (a, b) =>
        (a.width ?? 0) - (b.width ?? 0)
    );

  return sizes[0]?.source_url ?? media?.source_url;
}

function mapPost(post: WordPressPost): Post {
  const categories = post.categories ?? [];

  const category = categories.includes(
    CATEGORY_IDS.breaking
  )
    ? "Breaking"
    : categories.includes(CATEGORY_IDS.sports)
      ? "Sports"
      : categories.includes(CATEGORY_IDS.liveVideo)
        ? "Live Video"
        : "News";

  return {
    id: post.id,
    title: stripHtml(post.title?.rendered),
    excerpt: stripHtml(post.excerpt?.rendered),
    body: stripHtml(post.content?.rendered),
    bodyHtml: post.content?.rendered ?? "",
    image: chooseImage(post),
    imageCaption: stripHtml(
      post._embedded?.["wp:featuredmedia"]?.[0]
        ?.caption?.rendered
    ),
    category,
    date: post.date,
    modified: post.modified,
    author: post._embedded?.author?.[0]?.name,
    link: post.link,
  };
}

function seedArticleCache(posts: Post[]): void {
  for (const post of posts) {
    const key = `post-${post.id}`;

    const previous = memory.get(key) as
      | CacheEntry<Post>
      | undefined;

    if (
      previous?.data.modified &&
      post.modified &&
      previous.data.modified > post.modified
    ) {
      continue;
    }

    writeCache(key, post);
  }
}

function addPostFields(url: URL): void {
  url.searchParams.set(
    "_embed",
    "author,wp:featuredmedia"
  );
  url.searchParams.set("_fields", POST_FIELDS);
}

function emptyPage(): PaginatedPosts {
  return {
    posts: [],
    hasMore: false,
    nextPage: null,
  };
}

async function fetchPage(
  query: Query,
  page: number,
  size: number,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  if (
    query.categoryId === null ||
    query.tagId === null
  ) {
    return emptyPage();
  }

  const safePage = Number.isFinite(page)
    ? Math.max(1, Math.floor(page))
    : 1;

  const key = `page-v3:${JSON.stringify({
    ...query,
    page: safePage,
    size,
  })}`;

  const forceRefresh = Boolean(options.forceRefresh);

  return cachedRequest(
    key,
    forceRefresh,
    async (attempts) => {
      const url = new URL(
        `${WORDPRESS_BASE_URL}/posts`
      );

      addPostFields(url);

      url.searchParams.set(
        "page",
        String(safePage)
      );
      url.searchParams.set(
        "per_page",
        String(size)
      );

      if (query.categoryId) {
        url.searchParams.set(
          "categories",
          String(query.categoryId)
        );
      }

      if (query.tagId) {
        url.searchParams.set(
          "tags",
          String(query.tagId)
        );
      }

      if (query.search) {
        url.searchParams.set(
          "search",
          query.search
        );
        url.searchParams.set(
          "orderby",
          "relevance"
        );
      }

      if (query.breaking) {
        url.searchParams.set(
          "after",
          new Date(
            Date.now() - 48 * 60 * 60 * 1000
          ).toISOString()
        );
      }

      try {
        const { data, headers } =
          await requestJson<WordPressPost[]>(
            url,
            attempts,
            forceRefresh
          );

        if (!Array.isArray(data)) {
          throw new Error(
            "Invalid WordPress story list."
          );
        }

        const posts = data.map(mapPost);

        const header = headers.get(
          "X-WP-TotalPages"
        );

        const totalPages =
          header === null
            ? NaN
            : Number(header);

        const hasMore = Number.isFinite(totalPages)
          ? safePage < totalPages
          : posts.length === size;

        seedArticleCache(posts);

        return {
          posts,
          hasMore,
          nextPage: hasMore
            ? safePage + 1
            : null,
        };
      } catch (error) {
        if (
          error instanceof WordPressError &&
          error.code ===
            "rest_post_invalid_page_number" &&
          safePage > 1
        ) {
          return emptyPage();
        }

        throw error;
      }
    }
  );
}

async function lookupId(
  kind: "categories" | "tags",
  slug: string
): Promise<number | null> {
  return cachedRequest(
    `lookup-v3:${kind}:${slug}`,
    false,
    async (attempts) => {
      const url = new URL(
        `${WORDPRESS_BASE_URL}/${kind}`
      );

      url.searchParams.set("slug", slug);
      url.searchParams.set("_fields", "id");

      const { data } =
        await requestJson<Array<{ id: number }>>(
          url,
          attempts
        );

      if (!Array.isArray(data)) {
        throw new Error(
          "Invalid WordPress taxonomy response."
        );
      }

      return data[0]?.id ?? null;
    }
  );
}

export async function getTopStories(
  page = 1
): Promise<PaginatedPosts> {
  return fetchPage({}, page, PAGE_SIZE);
}

export async function getNewsPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  return fetchPage(
    { categoryId: CATEGORY_IDS.news },
    page,
    PAGE_SIZE,
    options
  );
}

export async function getSportsPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  return fetchPage(
    { categoryId: CATEGORY_IDS.sports },
    page,
    PAGE_SIZE,
    options
  );
}

export async function getBreakingPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const result = await fetchPage(
    {
      categoryId: CATEGORY_IDS.breaking,
      breaking: true,
    },
    page,
    PAGE_SIZE,
    options
  );

  // Enforce expiry even with an offline cached response.
  const cutoff =
    Date.now() - 48 * 60 * 60 * 1000;

  const posts = result.posts.filter((post) => {
    const date = new Date(post.date).getTime();

    return (
      Number.isFinite(date) &&
      date >= cutoff
    );
  });

  const hasMore =
    result.hasMore &&
    posts.length === result.posts.length;

  return {
    posts,
    hasMore,
    nextPage: hasMore
      ? result.nextPage
      : null,
  };
}

export async function getForestCountyNewsPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const categoryId = await lookupId(
    "categories",
    "forestcountynews"
  );

  return fetchPage(
    { categoryId },
    page,
    PAGE_SIZE,
    options
  );
}

export async function getLiveVideoPosts(
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  return fetchPage(
    { categoryId: CATEGORY_IDS.liveVideo },
    page,
    PAGE_SIZE,
    options
  );
}

export async function getPostsByCategory(
  category: string,
  page = 1,
  options: ContentRequestOptions = {}
): Promise<PaginatedPosts> {
  const normalized =
    category.trim().toLowerCase();

  if (normalized === "sports") {
    return getSportsPosts(page, options);
  }

  if (
    normalized === "breaking" ||
    normalized === "breaking-news"
  ) {
    return getBreakingPosts(page, options);
  }

  if (
    ["live video", "live-video", "watch"].includes(
      normalized
    )
  ) {
    return getLiveVideoPosts(page, options);
  }

  if (
    [
      "forest-county-news",
      "forest county news",
      "forestcountynews",
    ].includes(normalized)
  ) {
    return getForestCountyNewsPosts(
      page,
      options
    );
  }

  return getNewsPosts(page, options);
}

export async function getHomepageSections(
  options: ContentRequestOptions = {}
): Promise<HomeSection[]> {
  const topStory = lookupId(
    "tags",
    "app"
  ).then((tagId) =>
    fetchPage({ tagId }, 1, 1, options)
  );

  const results = await Promise.allSettled([
    topStory,
    getNewsPosts(1, options),
    getSportsPosts(1, options),
    getForestCountyNewsPosts(1, options),
  ]);

  if (
    results.every(
      (result) => result.status === "rejected"
    )
  ) {
    throw new Error(
      "All Home content sections failed."
    );
  }

  const posts = results.map((result) =>
    result.status === "fulfilled"
      ? result.value.posts
      : []
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `[WordPress] Home section ${index} failed:`,
        result.reason
      );
    }
  });

  return [
    {
      id: "top-story",
      title: "Top Story",
      slug: "top-story",
      type: "lead",
      category: "featured",
      posts: posts[0].slice(0, 1),
    },
    {
      id: "latest-news",
      title: "Latest News",
      slug: "latest-news",
      type: "list",
      category: "News",
      posts: posts[1].slice(0, 4),
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
      posts: posts[2].slice(0, 4),
    },
    {
      id: "forest-county-news",
      title: "Forest County News",
      slug: "forest-county-news",
      type: "list",
      category: "Forest County News",
      posts: posts[3].slice(0, 3),
    },
  ];
}

export async function getPostById(
  id: string,
  options: ContentRequestOptions = {}
): Promise<Post | undefined> {
  if (
    !/^\d+$/.test(id) ||
    Number(id) < 1
  ) {
    return undefined;
  }

  const key = `post-${Number(id)}`;

  try {
    return await cachedRequest(
      key,
      Boolean(options.forceRefresh),
      async (attempts) => {
        const url = new URL(
          `${WORDPRESS_BASE_URL}/posts/${Number(id)}`
        );

        addPostFields(url);

        const { data } =
          await requestJson<WordPressPost>(
            url,
            attempts,
            Boolean(options.forceRefresh)
          );

        if (
          !data ||
          data.id !== Number(id) ||
          !data.content
        ) {
          throw new Error(
            "Invalid WordPress story."
          );
        }

        return mapPost(data);
      }
    );
  } catch (error) {
    if (
      error instanceof WordPressError &&
      error.status === 404
    ) {
      memory.delete(key);

      void AsyncStorage.removeItem(
        `${STORAGE_CACHE_PREFIX}${key}`
      ).catch(() => undefined);

      return undefined;
    }

    throw error;
  }
}

export async function searchPosts(
  query: string,
  page = 1
): Promise<PaginatedPosts> {
  const search = query.trim();

  return search
    ? fetchPage(
        { search },
        page,
        SEARCH_PAGE_SIZE
      )
    : emptyPage();
}