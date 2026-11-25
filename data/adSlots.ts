export type LegacyAdPlacement =
  | "presenting-home"
  | "presenting-feed"
  | "premium-home"
  | "premium-article"
  | "featured-home"
  | "featured-article"
  | "legacy-rotation";

// Build 25 supports WordPress-managed dynamic placement keys.
// Legacy keys remain valid for existing Build 24-era campaigns.
export type AdPlacement = string;

export type AdRuleSurface =
  | "home"
  | "news"
  | "sports"
  | "forest-county-news"
  | "breaking"
  | "watch"
  | "saved"
  | "search"
  | "article";

export type AdRuleContentTarget =
  | "all"
  | "news"
  | "sports"
  | "forest-county-news"
  | "breaking"
  | "live-video";

export type FeedAdPosition = {
  type: "after-story";
  storyNumber: number;
};

export type ArticleAdPosition =
  | {
      type: "below-headline";
    }
  | {
      type: "after-paragraph";
      paragraphNumber: number;
    }
  | {
      type: "end-of-article";
    };

export type AdPlacementRule = {
  id: string;
  key: string;
  rotationId?: string;
  rotationKey?: string;
  rotationName?: string;
  rotationIntervalMs?: number;
  placement: AdPlacement;
  active: boolean;
  priority: number;
  surfaces: AdRuleSurface[];
  contentTargets: AdRuleContentTarget[];
  feedPosition?: FeedAdPosition;
  articlePosition?: ArticleAdPosition;
};

export type LocalAdImageKey =
  | "sample-ad"
  | "sponsor-1"
  | "sponsor-2"
  | "sponsor-3"
  | "sponsor-4"
  | "sponsor-5";

export type AdItem = {
  id: string;
  imageKey?: LocalAdImageKey;
  url?: string;
  phone?: string;
};

export type AdSlot = {
  placement: LegacyAdPlacement;
  rotationIntervalMs?: number;
  ads: AdItem[];
};

// Legacy physical ad locations remain available as a compatibility fallback.
// Build 25's primary ad placement behavior comes from WordPress placement rules.
export const adSlots: AdSlot[] = [
  {
    placement: "presenting-home",
    rotationIntervalMs: 7000,
    ads: [],
  },
  {
    placement: "presenting-feed",
    rotationIntervalMs: 7000,
    ads: [],
  },
  {
    placement: "premium-home",
    rotationIntervalMs: 7000,
    ads: [],
  },
  {
    placement: "premium-article",
    rotationIntervalMs: 7000,
    ads: [],
  },
  {
    placement: "featured-home",
    rotationIntervalMs: 7000,
    ads: [],
  },
  {
    placement: "featured-article",
    rotationIntervalMs: 7000,
    ads: [],
  },
  {
    placement: "legacy-rotation",
    rotationIntervalMs: 7000,
    ads: [],
  },
];

export function getAdSlotByPlacement(
  placement: AdPlacement
): AdSlot | undefined {
  return adSlots.find(
    (slot) =>
      slot.placement === placement
  );
}

export function normalizeAdRuleSurface(
  value: string
): AdRuleSurface | null {
  const normalized = value
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "home":
      return "home";
    case "news":
      return "news";
    case "sports":
      return "sports";
    case "forest-county-news":
    case "forest county news":
    case "forestcountynews":
      return "forest-county-news";
    case "breaking":
    case "breaking-news":
    case "breaking news":
      return "breaking";
    case "watch":
    case "live-video":
    case "live video":
      return "watch";
    case "saved":
    case "saved-stories":
    case "saved stories":
      return "saved";
    case "search":
      return "search";
    case "article":
    case "articles":
    case "content":
      return "article";
    default:
      return null;
  }
}

export function normalizeAdRuleContentTarget(
  value: string
): AdRuleContentTarget | null {
  const normalized = value
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "all":
    case "all-articles":
    case "all articles":
      return "all";
    case "news":
      return "news";
    case "sports":
      return "sports";
    case "forest-county-news":
    case "forest county news":
    case "forestcountynews":
      return "forest-county-news";
    case "breaking":
    case "breaking-news":
    case "breaking news":
      return "breaking";
    case "live-video":
    case "live video":
    case "watch":
      return "live-video";
    default:
      return null;
  }
}

export function isRuleForSurface(
  rule: AdPlacementRule,
  surface: AdRuleSurface
): boolean {
  return (
    rule.active &&
    rule.surfaces.includes(surface)
  );
}

export function isRuleForContentTarget(
  rule: AdPlacementRule,
  target: AdRuleContentTarget
): boolean {
  if (!rule.active) {
    return false;
  }

  if (
    rule.contentTargets.length === 0 ||
    rule.contentTargets.includes("all")
  ) {
    return true;
  }

  return rule.contentTargets.includes(
    target
  );
}

export function sortPlacementRules(
  rules: AdPlacementRule[]
): AdPlacementRule[] {
  return [...rules].sort(
    (left, right) => {
      if (
        right.priority !==
        left.priority
      ) {
        return (
          right.priority -
          left.priority
        );
      }

      return left.id.localeCompare(
        right.id
      );
    }
  );
}
