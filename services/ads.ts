import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import {
  sortPlacementRules,
  type AdPlacement,
  type AdPlacementRule,
  type AdRuleContentTarget,
  type AdRuleSurface,
} from "@/data/adSlots";

const ADS_BASE_URL =
  "https://yourdailylocal.com/wp-json/ydl-mobile/v1/ads";

const AD_RULES_BASE_URL =
  "https://yourdailylocal.com/wp-json/ydl-mobile/v1/ad-rules";

const ADS_CACHE_KEY_PREFIX =
  "ydl_mobile_ads_";

const AD_RULES_CACHE_KEY =
  "ydl_mobile_ad_rules";

const ADS_CACHE_TTL_MS =
  5 * 60 * 1000;

const ADS_STALE_MAX_AGE_MS =
  24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS =
  8000;

export type WordPressAd = {
  id: string;
  placement: string;
  sponsorId?: number;
  sponsorName?: string;
  campaignName?: string;
  imageUrl: string;
  destinationUrl?: string;
  phoneNumber?: string;
  priority: number;
  weight: number;
  rotationIntervalMs?: number;
};

type AdsApiItem = {
  id?: string | number;
  adId?: string | number;

  placement?: string;
  rotation?: string;
  rotationSlug?: string;

  sponsorId?: number;
  sponsor?: string;
  sponsorName?: string;

  campaignName?: string;

  imageUrl?: string;
  image_url?: string;

  destinationUrl?: string;
  targetUrl?: string;
  url?: string;

  phoneNumber?: string;
  phone?: string;

  priority?: number | string;
  weight?: number | string;

  intervalMs?: number | string;
  rotationIntervalMs?: number | string;
};

type AdsApiResponse =
  | AdsApiItem[]
  | {
      success?: boolean;
      ads?: AdsApiItem[];
      count?: number;
    };

type WordPressRuleRotation = {
  id?: string | number;
  slug?: string;
  name?: string;
  intervalMs?: number | string;
};

type WordPressRuleTabs = {
  targets?: string[];
  afterStory?: number | string;
};

type WordPressRuleArticlePosition = {
  type?: string;
  index?: number | string;
};

type WordPressRuleArticles = {
  targets?: string[];
  position?: WordPressRuleArticlePosition;
};

type WordPressPlacementRule = {
  id?: string | number;
  key?: string;
  name?: string;
  priority?: number | string;

  tabs?: WordPressRuleTabs;

  articles?: WordPressRuleArticles;

  rotation?: WordPressRuleRotation;
};

type PlacementRulesApiResponse =
  | WordPressPlacementRule[]
  | {
      rules?: WordPressPlacementRule[];
      count?: number;
    };

type AdsCacheEntry = {
  ads: WordPressAd[];
  timestamp: number;
};

type RulesCacheEntry = {
  rules: AdPlacementRule[];
  timestamp: number;
};

type AdRequest =
  | {
      type: "placement";
      value: AdPlacement;
    }
  | {
      type: "rotation";
      value: string;
      intervalMs?: number;
    };

type AdEventType =
  | "impression"
  | "click";

const adsMemoryCache =
  new Map<string, AdsCacheEntry>();

const adInFlightRequests =
  new Map<
    string,
    Promise<WordPressAd[]>
  >();

let rulesMemoryCache:
  | RulesCacheEntry
  | null = null;

let rulesInFlightRequest:
  | Promise<AdPlacementRule[]>
  | null = null;

const sessionId =
  createSessionId();

function createSessionId(): string {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function requestCacheKey(
  request: AdRequest
): string {
  return `${request.type}:${request.value}`;
}

function adsCacheKey(
  request: AdRequest
): string {
  return `${ADS_CACHE_KEY_PREFIX}${requestCacheKey(
    request
  )}`;
}

function isUsableCacheTimestamp(
  timestamp: number
): boolean {
  return (
    Date.now() - timestamp <=
    ADS_STALE_MAX_AGE_MS
  );
}

function isFreshCacheTimestamp(
  timestamp: number
): boolean {
  return (
    Date.now() - timestamp <=
    ADS_CACHE_TTL_MS
  );
}

function isUsableAdsCache(
  entry: AdsCacheEntry | null
): entry is AdsCacheEntry {
  return Boolean(
    entry &&
      isUsableCacheTimestamp(
        entry.timestamp
      )
  );
}

function isFreshAdsCache(
  entry: AdsCacheEntry
): boolean {
  return isFreshCacheTimestamp(
    entry.timestamp
  );
}

function isUsableRulesCache(
  entry: RulesCacheEntry | null
): entry is RulesCacheEntry {
  return Boolean(
    entry &&
      isUsableCacheTimestamp(
        entry.timestamp
      )
  );
}

function isFreshRulesCache(
  entry: RulesCacheEntry
): boolean {
  return isFreshCacheTimestamp(
    entry.timestamp
  );
}

function normalizeNumber(
  value: unknown,
  fallback: number
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}

function normalizeAds(
  payload: AdsApiResponse,
  request: AdRequest
): WordPressAd[] {
  const rawAds =
    Array.isArray(payload)
      ? payload
      : payload.ads ?? [];

  return rawAds.flatMap(
    (rawAd) => {
      const id =
        rawAd.adId ??
        rawAd.id;

      const imageUrl =
        rawAd.imageUrl ??
        rawAd.image_url;

      if (
        id === undefined ||
        !imageUrl?.trim()
      ) {
        return [];
      }

      const responsePlacement =
        rawAd.placement?.trim() ||
        rawAd.rotationSlug?.trim() ||
        rawAd.rotation?.trim() ||
        request.value;

      return [
        {
          id: String(id),
          placement:
            responsePlacement,
          sponsorId:
            rawAd.sponsorId,
          sponsorName:
            rawAd.sponsorName?.trim() ||
            rawAd.sponsor?.trim() ||
            undefined,
          campaignName:
            rawAd.campaignName?.trim() ||
            undefined,
          imageUrl:
            imageUrl.trim(),
          destinationUrl:
            rawAd.destinationUrl?.trim() ||
            rawAd.targetUrl?.trim() ||
            rawAd.url?.trim() ||
            undefined,
          phoneNumber:
            rawAd.phoneNumber?.trim() ||
            rawAd.phone?.trim() ||
            undefined,
          priority:
            normalizeNumber(
              rawAd.priority,
              10
            ),
          weight:
            Math.max(
              1,
              normalizeNumber(
                rawAd.weight,
                1
              )
            ),
          rotationIntervalMs:
            request.type ===
            "rotation"
              ? request.intervalMs
              : normalizeNumber(
                  rawAd.rotationIntervalMs ??
                    rawAd.intervalMs,
                  7000
                ),
        },
      ];
    }
  );
}

function normalizeTabTargets(
  values: string[] | undefined
): AdRuleSurface[] {
  if (!values) {
    return [];
  }

  return values.flatMap(
    (value) => {
      const normalized =
        value
          .trim()
          .toLowerCase();

      switch (normalized) {
        case "home":
          return ["home"];

        case "news":
          return ["news"];

        case "sports":
          return ["sports"];

        case "watch":
          return ["watch"];

        case "saved":
          return ["saved"];

        case "search":
          return ["search"];

        default:
          return [];
      }
    }
  );
}

function normalizeArticleTargets(
  values: string[] | undefined
): AdRuleContentTarget[] {
  if (!values) {
    return [];
  }

  return values.flatMap(
    (value) => {
      const normalized =
        value
          .trim()
          .toLowerCase();

      switch (normalized) {
        case "all":
        case "all-articles":
          return ["all"];

        case "news":
          return ["news"];

        case "sports":
          return ["sports"];

        case "forest-county-news":
          return [
            "forest-county-news",
          ];

        case "breaking":
          return ["breaking"];

        case "live-video":
          return ["live-video"];

        default:
          return [];
      }
    }
  );
}

function normalizePlacementRules(
  payload: PlacementRulesApiResponse
): AdPlacementRule[] {
  const rawRules =
    Array.isArray(payload)
      ? payload
      : payload.rules ?? [];

  const rules: AdPlacementRule[] =
    rawRules.flatMap(
      (rawRule, index) => {
        const id =
          rawRule.id ??
          index + 1;

        const key =
          rawRule.key?.trim() ||
          String(id);

        const rotationSlug =
          rawRule.rotation
            ?.slug?.trim();

        if (!rotationSlug) {
          return [];
        }

        const surfaces: AdRuleSurface[] =
          [];

        const tabTargets =
          normalizeTabTargets(
            rawRule.tabs?.targets
          );

        surfaces.push(
          ...tabTargets
        );

        const articleTargets =
          normalizeArticleTargets(
            rawRule.articles
              ?.targets
          );

        if (
          rawRule.articles
            ?.position?.type
        ) {
          surfaces.push(
            "article"
          );
        }

        const afterStory =
          normalizeNumber(
            rawRule.tabs
              ?.afterStory,
            0
          );

        const articlePosition =
          rawRule.articles
            ?.position;

        let normalizedArticlePosition:
          AdPlacementRule["articlePosition"];

        if (
          articlePosition
            ?.type ===
          "below-headline"
        ) {
          normalizedArticlePosition =
            {
              type:
                "below-headline",
            };
        } else if (
          articlePosition
            ?.type ===
          "end-of-article"
        ) {
          normalizedArticlePosition =
            {
              type:
                "end-of-article",
            };
        } else if (
          articlePosition
            ?.type ===
          "after-paragraph"
        ) {
          const paragraphNumber =
            normalizeNumber(
              articlePosition.index,
              0
            );

          if (
            paragraphNumber >
            0
          ) {
            normalizedArticlePosition =
              {
                type:
                  "after-paragraph",
                paragraphNumber:
                  Math.floor(
                    paragraphNumber
                  ),
              };
          }
        }

        const rotationIntervalMs =
          Math.max(
            1000,
            normalizeNumber(
              rawRule.rotation
                ?.intervalMs,
              7000
            )
          );

        const normalizedRule: AdPlacementRule =
          {
            id: String(id),
            key,

            rotationId:
              rawRule.rotation
                ?.id !==
              undefined
                ? String(
                    rawRule.rotation
                      .id
                  )
                : undefined,

            rotationKey:
              rotationSlug,

            rotationName:
              rawRule.rotation
                ?.name?.trim() ||
              undefined,

            rotationIntervalMs,

            // Dynamic rules use the rotation slug
            // as the ad source key.
            placement:
              rotationSlug,

            active: true,

            priority:
              normalizeNumber(
                rawRule.priority,
                10
              ),

            surfaces: [
              ...new Set(
                surfaces
              ),
            ],

            contentTargets:
              articleTargets,

            feedPosition:
              afterStory > 0 &&
              tabTargets.length >
                0
                ? {
                    type:
                      "after-story" as const,
                    storyNumber:
                      Math.floor(
                        afterStory
                      ),
                  }
                : undefined,

            articlePosition:
              normalizedArticlePosition,
          };

        return [
          normalizedRule,
        ];
      }
    );

  return sortPlacementRules(
    rules
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal,
      }
    );
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

async function readPersistentAdsCache(
  request: AdRequest
): Promise<AdsCacheEntry | null> {
  try {
    const raw =
      await AsyncStorage.getItem(
        adsCacheKey(
          request
        )
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw
      ) as AdsCacheEntry;

    return isUsableAdsCache(
      parsed
    )
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function writeAdsCache(
  request: AdRequest,
  ads: WordPressAd[]
): Promise<void> {
  const entry: AdsCacheEntry =
    {
      ads,
      timestamp:
        Date.now(),
    };

  const key =
    requestCacheKey(
      request
    );

  adsMemoryCache.set(
    key,
    entry
  );

  try {
    await AsyncStorage.setItem(
      adsCacheKey(
        request
      ),
      JSON.stringify(
        entry
      )
    );
  } catch {
    // Cache failures must never block ads.
  }
}

async function readPersistentRulesCache(): Promise<RulesCacheEntry | null> {
  try {
    const raw =
      await AsyncStorage.getItem(
        AD_RULES_CACHE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw
      ) as RulesCacheEntry;

    return isUsableRulesCache(
      parsed
    )
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function writeRulesCache(
  rules: AdPlacementRule[]
): Promise<void> {
  const entry: RulesCacheEntry =
    {
      rules,
      timestamp:
        Date.now(),
    };

  rulesMemoryCache =
    entry;

  try {
    await AsyncStorage.setItem(
      AD_RULES_CACHE_KEY,
      JSON.stringify(
        entry
      )
    );
  } catch {
    // Cache failures must never block ads.
  }
}

async function fetchAndCacheAds(
  request: AdRequest
): Promise<WordPressAd[]> {
  const key =
    requestCacheKey(
      request
    );

  const existingRequest =
    adInFlightRequests.get(
      key
    );

  if (existingRequest) {
    return existingRequest;
  }

  const promise =
    (async () => {
      const url =
        new URL(
          ADS_BASE_URL
        );

      if (
        request.type ===
        "rotation"
      ) {
        url.searchParams.set(
          "rotation",
          request.value
        );
      } else {
        url.searchParams.set(
          "placement",
          request.value
        );
      }

      url.searchParams.set(
        "_ydl_refresh",
        String(
          Date.now()
        )
      );

      const response =
        await fetchWithTimeout(
          url.toString(),
          {
            headers: {
              Accept:
                "application/json",
              "Cache-Control":
                "no-cache",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          `Unable to load app ads: ${response.status}`
        );
      }

      const payload =
        (await response.json()) as AdsApiResponse;

      const ads =
        normalizeAds(
          payload,
          request
        );

      await writeAdsCache(
        request,
        ads
      );

      return ads;
    })().finally(() => {
      adInFlightRequests.delete(
        key
      );
    });

  adInFlightRequests.set(
    key,
    promise
  );

  return promise;
}

async function fetchAndCachePlacementRules(): Promise<AdPlacementRule[]> {
  if (
    rulesInFlightRequest
  ) {
    return rulesInFlightRequest;
  }

  rulesInFlightRequest =
    (async () => {
      const url =
        new URL(
          AD_RULES_BASE_URL
        );

      url.searchParams.set(
        "_ydl_refresh",
        String(
          Date.now()
        )
      );

      const response =
        await fetchWithTimeout(
          url.toString(),
          {
            headers: {
              Accept:
                "application/json",
              "Cache-Control":
                "no-cache",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          `Unable to load ad placement rules: ${response.status}`
        );
      }

      const payload =
        (await response.json()) as PlacementRulesApiResponse;

      const rules =
        normalizePlacementRules(
          payload
        );

      await writeRulesCache(
        rules
      );

      return rules;
    })().finally(() => {
      rulesInFlightRequest =
        null;
    });

  return rulesInFlightRequest;
}

async function getAdsByRequest(
  request: AdRequest,
  forceRefresh = false
): Promise<WordPressAd[]> {
  const key =
    requestCacheKey(
      request
    );

  if (!forceRefresh) {
    const memoryEntry =
      adsMemoryCache.get(
        key
      ) ?? null;

    if (
      isUsableAdsCache(
        memoryEntry
      )
    ) {
      if (
        !isFreshAdsCache(
          memoryEntry
        )
      ) {
        void fetchAndCacheAds(
          request
        ).catch(
          () => undefined
        );
      }

      return memoryEntry.ads;
    }

    const persistentEntry =
      await readPersistentAdsCache(
        request
      );

    if (persistentEntry) {
      adsMemoryCache.set(
        key,
        persistentEntry
      );

      if (
        !isFreshAdsCache(
          persistentEntry
        )
      ) {
        void fetchAndCacheAds(
          request
        ).catch(
          () => undefined
        );
      }

      return persistentEntry.ads;
    }
  }

  try {
    return await fetchAndCacheAds(
      request
    );
  } catch (error) {
    const memoryEntry =
      adsMemoryCache.get(
        key
      ) ?? null;

    if (
      isUsableAdsCache(
        memoryEntry
      )
    ) {
      return memoryEntry.ads;
    }

    const persistentEntry =
      await readPersistentAdsCache(
        request
      );

    if (persistentEntry) {
      adsMemoryCache.set(
        key,
        persistentEntry
      );

      return persistentEntry.ads;
    }

    throw error;
  }
}

export async function getAds(
  placement: AdPlacement,
  forceRefresh = false
): Promise<WordPressAd[]> {
  return getAdsByRequest(
    {
      type: "placement",
      value: placement,
    },
    forceRefresh
  );
}

export async function getAdsForRotation(
  rotationSlug: string,
  rotationIntervalMs = 7000,
  forceRefresh = false
): Promise<WordPressAd[]> {
  return getAdsByRequest(
    {
      type: "rotation",
      value:
        rotationSlug,
      intervalMs:
        rotationIntervalMs,
    },
    forceRefresh
  );
}

export async function getAdPlacementRules(
  forceRefresh = false
): Promise<AdPlacementRule[]> {
  if (
    !forceRefresh &&
    isUsableRulesCache(
      rulesMemoryCache
    )
  ) {
    if (
      !isFreshRulesCache(
        rulesMemoryCache
      )
    ) {
      void fetchAndCachePlacementRules().catch(
        () => undefined
      );
    }

    return rulesMemoryCache.rules;
  }

  if (!forceRefresh) {
    const persistentEntry =
      await readPersistentRulesCache();

    if (persistentEntry) {
      rulesMemoryCache =
        persistentEntry;

      if (
        !isFreshRulesCache(
          persistentEntry
        )
      ) {
        void fetchAndCachePlacementRules().catch(
          () => undefined
        );
      }

      return persistentEntry.rules;
    }
  }

  try {
    return await fetchAndCachePlacementRules();
  } catch (error) {
    if (
      isUsableRulesCache(
        rulesMemoryCache
      )
    ) {
      return rulesMemoryCache.rules;
    }

    const persistentEntry =
      await readPersistentRulesCache();

    if (persistentEntry) {
      rulesMemoryCache =
        persistentEntry;

      return persistentEntry.rules;
    }

    throw error;
  }
}

export async function getFeedPlacementRules(
  surface: AdRuleSurface,
  forceRefresh = false
): Promise<AdPlacementRule[]> {
  const rules =
    await getAdPlacementRules(
      forceRefresh
    );

  return rules.filter(
    (rule) =>
      rule.active &&
      rule.surfaces.includes(
        surface
      ) &&
      rule.feedPosition?.type ===
        "after-story"
  );
}

export async function getArticlePlacementRules(
  contentTarget: AdRuleContentTarget,
  forceRefresh = false
): Promise<AdPlacementRule[]> {
  const rules =
    await getAdPlacementRules(
      forceRefresh
    );

  return rules.filter(
    (rule) => {
      if (
        !rule.active ||
        !rule.surfaces.includes(
          "article"
        ) ||
        !rule.articlePosition
      ) {
        return false;
      }

      if (
        rule.contentTargets.length ===
          0 ||
        rule.contentTargets.includes(
          "all"
        )
      ) {
        return true;
      }

      return rule.contentTargets.includes(
        contentTarget
      );
    }
  );
}

export function buildWeightedRotation(
  ads: WordPressAd[]
): WordPressAd[] {
  return [...ads].sort(
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

      const leftScore =
        Math.random() **
        (1 /
          Math.max(
            1,
            left.weight
          ));

      const rightScore =
        Math.random() **
        (1 /
          Math.max(
            1,
            right.weight
          ));

      return (
        rightScore -
        leftScore
      );
    }
  );
}

async function recordAdEvent(
  eventType: AdEventType,
  adId: string,
  placement: string
): Promise<void> {
  try {
    await fetchWithTimeout(
      `${ADS_BASE_URL}/${eventType}`,
      {
        method: "POST",
        headers: {
          Accept:
            "application/json",
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            adId,
            placement,
            sessionId,
            platform:
              Platform.OS,
          }),
      }
    );
  } catch {
    // Ad reporting must never interrupt the app.
  }
}

export function recordAdImpression(
  adId: string,
  placement: string
): Promise<void> {
  return recordAdEvent(
    "impression",
    adId,
    placement
  );
}

export function recordAdClick(
  adId: string,
  placement: string
): Promise<void> {
  return recordAdEvent(
    "click",
    adId,
    placement
  );
}