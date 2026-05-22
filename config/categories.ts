export type CategoryConfig = {
  slug: string;
  title: string;
  category: string;
  showAds: boolean;
};

export const CATEGORIES: Record<string, CategoryConfig> = {
  "latest-news": {
    slug: "latest-news",
    title: "Latest News",
    category: "News",
    showAds: true,
  },
  news: {
    slug: "news",
    title: "Latest News",
    category: "News",
    showAds: true,
  },
  sports: {
    slug: "sports",
    title: "Sports",
    category: "Sports",
    showAds: true,
  },
  breaking: {
    slug: "breaking",
    title: "Breaking",
    category: "Breaking",
    showAds: false,
  },
  "forest-county-news": {
    slug: "forest-county-news",
    title: "Forest County News",
    category: "Forest County News",
    showAds: true,
  },
};

export function getCategoryConfig(slug?: string): CategoryConfig {
  if (!slug) return CATEGORIES["latest-news"];

  return CATEGORIES[slug] ?? {
    slug,
    title: "Stories",
    category: slug,
    showAds: true,
  };
}