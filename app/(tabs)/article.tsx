import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import {
  Stack,
  router,
  useLocalSearchParams,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import RotatingAdSlot from "@/components/RotatingAdSlot";
import type {
  AdPlacementRule,
  AdRuleContentTarget,
} from "@/data/adSlots";
import { getArticlePlacementRules } from "@/services/ads";
import {
  trackArticleOpen,
  trackSavedStory,
  trackSharedStory,
} from "@/services/analytics";
import {
  getPostById,
  getPostsByCategory,
} from "@/services/api";
import {
  isPostSaved,
  toggleSavedPost,
} from "@/services/savedPosts";
import type { Post } from "@/types/Post";
import { formatDisplayDate } from "@/utils/formatDisplayDate";

const ARTICLE_BACKGROUND_REFRESH_MS = 60 * 1000;
const YDL_BASE_URL = "https://yourdailylocal.com";

type ArticleLoadMode = "initial" | "manual" | "background";

type ArticleSegment = {
  id: string;
  content: string;
  paragraphNumber: number;
};

const LEGACY_ARTICLE_FALLBACK_RULES: AdPlacementRule[] = [
  {
    id: "legacy-premium-article",
    key: "legacy-premium-article",
    placement: "premium-article",
    active: true,
    priority: 100,
    surfaces: ["article"],
    contentTargets: ["all"],
    articlePosition: { type: "below-headline" },
  },
  {
    id: "legacy-featured-article",
    key: "legacy-featured-article",
    placement: "featured-article",
    active: true,
    priority: 50,
    surfaces: ["article"],
    contentTargets: ["all"],
    articlePosition: {
      type: "after-paragraph",
      paragraphNumber: 3,
    },
  },
  {
    id: "legacy-end-article",
    key: "legacy-end-article",
    placement: "legacy-rotation",
    active: true,
    priority: 10,
    surfaces: ["article"],
    contentTargets: ["all"],
    articlePosition: {
      type: "after-paragraph",
      paragraphNumber: 6,
    },
  },
];

function cleanArticleHtml(html = ""): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<div\b[^>]*class=["'][^"']*\bwp-block-spacer\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
      ""
    )
    .replace(
      /<div\b[^>]*class=["'][^"']*\b(?:advertisement|ad-placeholder|ad-container)\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
      ""
    )
    .replace(
      /<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi,
      ""
    )
    .replace(
      /<div\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/div>/gi,
      ""
    )
    .trim();
}

function splitHtmlIntoSegments(
  html: string,
  rules: AdPlacementRule[]
): ArticleSegment[] {
  const cleaned = cleanArticleHtml(html);
  if (!cleaned) return [];

  const breaks = new Set<number>();

  for (const rule of rules) {
    if (rule.articlePosition?.type === "after-paragraph") {
      breaks.add(rule.articlePosition.paragraphNumber);
    }
  }

  if (breaks.size === 0) {
    return [
      {
        id: "html-1",
        content: cleaned,
        paragraphNumber: 0,
      },
    ];
  }

  const segments: ArticleSegment[] = [];
  const openTags: Array<{ name: string; tag: string }> = [];

  const voidTags = new Set([
    "area", "base", "br", "col", "embed", "hr", "img",
    "input", "link", "meta", "param", "source", "track", "wbr",
  ]);

  // Treat quoted attributes and raw-text elements as units.
  const tokens =
    /<!--[\s\S]*?-->|<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<(?:[^<>"']|"[^"]*"|'[^']*')+>/gi;

  let match: RegExpExecArray | null;
  let paragraphNumber = 0;
  let start = 0;
  let prefix = "";

  while ((match = tokens.exec(cleaned)) !== null) {
    const tag = match[0];

    if (tag.startsWith("<!--") || match[1]) continue;

    const parsed =
      /^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b/i.exec(tag);

    if (!parsed) continue;

    const name = parsed[2].toLowerCase();

    if (parsed[1]) {
      for (let i = openTags.length - 1; i >= 0; i -= 1) {
        if (openTags[i].name === name) {
          openTags.splice(i);
          break;
        }
      }

      if (name !== "p") continue;

      paragraphNumber += 1;

      if (!breaks.has(paragraphNumber)) continue;

      const end = match.index + tag.length;

      const suffix = openTags
        .slice()
        .reverse()
        .map((item) => `</${item.name}>`)
        .join("");

      segments.push({
        id: `html-${segments.length + 1}`,
        content: prefix + cleaned.slice(start, end) + suffix,
        paragraphNumber,
      });

      // Keep container markup balanced in each document.
      prefix = openTags.map((item) => item.tag).join("");
      start = end;
    } else if (
      !voidTags.has(name) &&
      !/\/\s*>$/.test(tag)
    ) {
      openTags.push({ name, tag });
    }
  }

  const remainder = cleaned.slice(start);

  if (
    remainder.trim() &&
    !/^(?:\s|<\/[^>]+>)*$/.test(remainder)
  ) {
    segments.push({
      id: `html-${segments.length + 1}`,
      content: prefix + remainder,
      paragraphNumber: 0,
    });
  }

  return segments;
}

function splitTextIntoSegments(text = ""): ArticleSegment[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((content, index) => ({
      id: `text-${index + 1}`,
      content,
      paragraphNumber: index + 1,
    }));
}

function getArticleContentTarget(
  category = ""
): AdRuleContentTarget {
  const value = category.trim().toLowerCase();

  if (value.includes("sports")) return "sports";
  if (value.includes("forest")) return "forest-county-news";
  if (value.includes("breaking")) return "breaking";

  if (
    value.includes("live video") ||
    value.includes("live-video")
  ) {
    return "live-video";
  }

  return "news";
}

function getAfterParagraphRules(
  rules: AdPlacementRule[],
  paragraphNumber: number
): AdPlacementRule[] {
  return rules.filter(
    (rule) =>
      rule.articlePosition?.type === "after-paragraph" &&
      rule.articlePosition.paragraphNumber === paragraphNumber
  );
}

function hasPostChanged(
  current: Post | undefined,
  next: Post
): boolean {
  return (
    !current ||
    current.id !== next.id ||
    current.modified !== next.modified ||
    current.title !== next.title ||
    current.excerpt !== next.excerpt ||
    current.body !== next.body ||
    current.bodyHtml !== next.bodyHtml ||
    current.image !== next.image ||
    current.imageCaption !== next.imageCaption ||
    current.category !== next.category ||
    current.date !== next.date ||
    current.author !== next.author
  );
}

function buildHtmlDocument(bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  * { box-sizing: border-box; }
  html, body { background: transparent; margin: 0; padding: 0; }
  #ydl-content { display: flow-root; min-height: 1px; }
  body {
    color: #222;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    font-size: 18px;
    line-height: 1.72;
    overflow-wrap: anywhere;
  }
  p { margin: 0 0 24px; }
  p:empty, div:empty, figure:empty, section:empty,
  .wp-block-spacer, .advertisement, .ad-placeholder,
  .ad-container, .adsbygoogle {
    display: none !important;
    height: 0 !important;
    margin: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #111;
    line-height: 1.25;
    margin: 28px 0 14px;
  }
  h1 { font-size: 30px; }
  h2 { font-size: 26px; }
  h3 { font-size: 22px; }
  a { color: #b00020; font-weight: 700; text-decoration: underline; }
  ul, ol { margin: 0 0 24px; padding-left: 26px; }
  li { margin-bottom: 8px; }
  blockquote {
    border-left: 4px solid #b00020;
    color: #444;
    font-style: italic;
    margin: 0 0 24px;
    padding: 4px 0 4px 18px;
  }
  img {
    display: block;
    height: auto !important;
    margin: 18px auto;
    max-width: 100% !important;
  }
  figure { margin: 20px 0; max-width: 100%; }
  figcaption {
    color: #666;
    font-size: 13px;
    font-style: italic;
    line-height: 1.45;
    margin-top: 8px;
  }
  iframe, video {
    border: 0;
    display: block;
    max-width: 100%;
    width: 100%;
  }
  .wp-block-embed__wrapper { position: relative; width: 100%; }
  table {
    border-collapse: collapse;
    display: block;
    margin: 18px 0 24px;
    max-width: 100%;
    overflow-x: auto;
    white-space: nowrap;
    width: 100%;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 10px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f1f1f1; font-weight: 800; }
  pre {
    background: #f4f4f4;
    border-radius: 8px;
    overflow-x: auto;
    padding: 14px;
    white-space: pre-wrap;
  }
</style>
</head>
<body>
<article id="ydl-content">${bodyHtml}</article>
<script>
(function () {
  var root = document.getElementById('ydl-content');
  var lastHeight = 0;
  var queued = false;

  function measure() {
    queued = false;
    var height = Math.max(
      1,
      Math.ceil(root.getBoundingClientRect().height)
    );
    if (height === lastHeight) return;
    lastHeight = height;

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'height',
      height: height
    }));
  }

  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(measure);
  }

  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);

  if (window.ResizeObserver) {
    new ResizeObserver(schedule).observe(root);
  }

  root.querySelectorAll('img,iframe,video').forEach(function (item) {
    item.addEventListener('load', schedule);
    item.addEventListener('error', schedule);
    item.addEventListener('loadedmetadata', schedule);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedule);
  }

  schedule();
  setTimeout(schedule, 300);
  setTimeout(schedule, 1200);
})();
</script>
</body>
</html>`;
}

const HtmlArticle = memo(function HtmlArticle({
  html,
  width,
}: {
  html: string;
  width: number;
}) {
  const [height, setHeight] = useState(1);
  const initialLoadRef = useRef(true);

  const source = useMemo(
    () => ({
      html: buildHtmlDocument(html),
      baseUrl: YDL_BASE_URL,
    }),
    [html]
  );

  return (
    <WebView
      source={source}
      style={{
        width,
        height,
        backgroundColor: "transparent",
      }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      setSupportMultipleWindows={false}
      onMessage={(event) => {
        try {
          const message = JSON.parse(
            event.nativeEvent.data
          ) as {
            type?: string;
            height?: number;
          };

          if (
            message.type === "height" &&
            typeof message.height === "number" &&
            Number.isFinite(message.height)
          ) {
            const next = Math.max(
              1,
              Math.ceil(message.height)
            );

            setHeight((previous) =>
              previous === next ? previous : next
            );
          }
        } catch {
          // Ignore unrelated browser messages.
        }
      }}
      onShouldStartLoadWithRequest={(request) => {
        if (initialLoadRef.current) {
          initialLoadRef.current = false;
          return true;
        }

        const url = request.url;

        if (request.isTopFrame === false) return true;

        if (
          url === "about:blank" ||
          url.startsWith("data:text/html") ||
          url === YDL_BASE_URL ||
          url === `${YDL_BASE_URL}/`
        ) {
          return true;
        }

        if (/^https?:\/\//i.test(url)) {
          void Linking.openURL(url).catch(
            () => undefined
          );
          return false;
        }

        return true;
      }}
    />
  );
});

const RelatedStoryCard = memo(function RelatedStoryCard({
  post,
}: {
  post: Post;
}) {
  return (
    <Pressable
      style={styles.relatedCard}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/article",
          params: {
            id: String(post.id),
            fresh: "1",
          },
        })
      }
    >
      {post.image ? (
        <Image
          source={{ uri: post.image }}
          style={styles.relatedImage}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={String(post.id)}
        />
      ) : null}

      <View style={styles.relatedContent}>
        <Text style={styles.relatedCategory}>
          {post.category}
        </Text>
        <Text style={styles.relatedHeadline}>
          {post.title}
        </Text>
      </View>
    </Pressable>
  );
});

function DynamicArticleAds({
  rules,
}: {
  rules: AdPlacementRule[];
}) {
  return (
    <>
      {rules.map((rule) =>
        rule.rotationKey ? (
          <RotatingAdSlot
            key={`${rule.id}-${rule.key}`}
            rotationSlug={rule.rotationKey}
            trackingPlacement={rule.key}
            rotationIntervalMs={rule.rotationIntervalMs}
          />
        ) : (
          <RotatingAdSlot
            key={`${rule.id}-${rule.placement}`}
            placement={rule.placement}
          />
        )
      )}
    </>
  );
}

export default function ArticleScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    fresh?: string;
    source?: string;
  }>();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const { width: windowWidth } = useWindowDimensions();
  const isFocused = useIsFocused();

  const [appActive, setAppActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );

  const [post, setPost] = useState<Post | undefined>();
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [adRules, setAdRules] = useState<AdPlacementRule[]>(
    LEGACY_ARTICLE_FALLBACK_RULES
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null
  );

  const activeLoadIdRef = useRef(0);
  const currentPostRef = useRef<Post | undefined>(undefined);
  const trackedArticleIdRef = useRef<number | null>(null);
  const requestRunningRef = useRef(false);
  const savedChangeRef = useRef(0);
  const lastLoadRef = useRef(0);

  const htmlSegments = useMemo(
    () => splitHtmlIntoSegments(post?.bodyHtml ?? "", adRules),
    [post?.bodyHtml, adRules]
  );

  const textSegments = useMemo(
    () => splitTextIntoSegments(post?.body ?? ""),
    [post?.body]
  );

  const htmlWidth = Math.max(240, windowWidth - 44);

  const belowHeadlineRules = useMemo(
    () =>
      adRules.filter(
        (rule) =>
          rule.articlePosition?.type === "below-headline"
      ),
    [adRules]
  );

  const endOfArticleRules = useMemo(
    () =>
      adRules.filter(
        (rule) =>
          rule.articlePosition?.type === "end-of-article"
      ),
    [adRules]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (state) => setAppActive(state === "active")
    );

    return () => subscription.remove();
  }, []);

  const loadPost = useCallback(
    async (mode: ArticleLoadMode = "initial") => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      if (
        mode === "background" &&
        requestRunningRef.current
      ) {
        return;
      }

      const loadId = ++activeLoadIdRef.current;
      requestRunningRef.current = true;

      const isCurrent = () =>
        activeLoadIdRef.current === loadId;

      const forceRefresh = mode !== "initial";

      try {
        if (mode === "initial") setIsLoading(true);
        if (mode === "manual") setIsRefreshing(true);
        if (mode !== "background") setErrorMessage(null);

        const result = await getPostById(id, {
          forceRefresh,
        });

        if (!isCurrent()) return;

        if (!result) {
          if (!currentPostRef.current) {
            setErrorMessage(
              "This story could not be loaded."
            );
          }
          return;
        }

        const changed = hasPostChanged(
          currentPostRef.current,
          result
        );

        if (changed) {
          currentPostRef.current = result;
          setPost(result);
        }

        if (
          trackedArticleIdRef.current !== result.id
        ) {
          trackArticleOpen(result.id, result.title);
          trackedArticleIdRef.current = result.id;
        }

        setErrorMessage(null);
        lastLoadRef.current = Date.now();

        // These requests do not delay the article.
        void getArticlePlacementRules(
          getArticleContentTarget(result.category),
          forceRefresh
        )
          .then((rules) => {
            if (isCurrent()) {
              setAdRules(
                rules.length
                  ? rules
                  : LEGACY_ARTICLE_FALLBACK_RULES
              );
            }
          })
          .catch(() => {
            // Preserve current placements on failure.
          });

        const savedVersion = savedChangeRef.current;

        void isPostSaved(result.id)
          .then((saved) => {
            if (
              isCurrent() &&
              savedVersion === savedChangeRef.current
            ) {
              setIsSaved(saved);
            }
          })
          .catch(() => undefined);

        if (changed || mode === "manual") {
          void (
            result.category
              ? getPostsByCategory(
                  result.category,
                  1,
                  {
                    forceRefresh: mode === "manual",
                  }
                )
              : Promise.resolve(null)
          )
            .then((related) => {
              if (isCurrent()) {
                setRelatedPosts(
                  related
                    ? related.posts
                        .filter(
                          (item) => item.id !== result.id
                        )
                        .slice(0, 3)
                    : []
                );
              }
            })
            .catch(() => {
              // Preserve related stories on failure.
            });
        }
      } catch (error) {
        if (
          isCurrent() &&
          !currentPostRef.current
        ) {
          setErrorMessage(
            "Unable to load the latest version of this story."
          );
        }

        console.warn(
          "[Article] Unable to refresh story:",
          error
        );
      } finally {
        if (isCurrent()) {
          requestRunningRef.current = false;
          setIsLoading(false);

          if (mode === "manual") {
            setIsRefreshing(false);
          }
        }
      }
    },
    [id]
  );

  useEffect(() => {
    currentPostRef.current = undefined;
    trackedArticleIdRef.current = null;
    lastLoadRef.current = 0;
    savedChangeRef.current += 1;

    setPost(undefined);
    setRelatedPosts([]);
    setIsSaved(false);
    setIsSaving(false);
    setIsRefreshing(false);
    setAdRules(LEGACY_ARTICLE_FALLBACK_RULES);

    void loadPost("initial");

    return () => {
      activeLoadIdRef.current += 1;
    };
  }, [loadPost]);

  useEffect(() => {
    if (!isFocused || !appActive) return;

    if (
      lastLoadRef.current &&
      Date.now() - lastLoadRef.current >=
        ARTICLE_BACKGROUND_REFRESH_MS
    ) {
      void loadPost("background");
    }

    const timer = setInterval(
      () => void loadPost("background"),
      ARTICLE_BACKGROUND_REFRESH_MS
    );

    return () => clearInterval(timer);
  }, [isFocused, appActive, loadPost]);

  const shareArticle = useCallback(async () => {
    if (!post) return;

    try {
      await Share.share({
        title: post.title,
        message: post.link
          ? `${post.title}\n\n${post.link}`
          : `${post.title}\n\nShared from Your Daily Local`,
      });

      trackSharedStory(post.id, post.title);
    } catch {
      // Share canceled or unavailable.
    }
  }, [post]);

  const handleToggleSaved = useCallback(async () => {
    if (!post || isSaving) return;

    const postId = post.id;
    savedChangeRef.current += 1;

    try {
      setIsSaving(true);

      const next = await toggleSavedPost(post);

      if (
        currentPostRef.current?.id !== postId
      ) {
        return;
      }

      setIsSaved(next);

      if (next) {
        trackSavedStory(post.id, post.title);
      }
    } catch {
      if (
        currentPostRef.current?.id === postId
      ) {
        setErrorMessage(
          "Unable to update saved story. Please try again."
        );
      }
    } finally {
      if (
        currentPostRef.current?.id === postId
      ) {
        setIsSaving(false);
      }
    }
  }, [post, isSaving]);

  if (isLoading || !post) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right"]}
      >
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          {isLoading ? (
            <>
              <ActivityIndicator size="large" />
              <Text style={styles.centerText}>
                Loading the latest story...
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.notFoundTitle}>
                Story not found
              </Text>

              <Text style={styles.centerText}>
                {errorMessage ??
                  "This story could not be loaded."}
              </Text>

              <Pressable
                style={styles.backButtonLarge}
                onPress={() => router.back()}
              >
                <Text style={styles.backButtonLargeText}>
                  Go Back
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <StatusBar style="light" />

      <Stack.Screen
        options={{
          title: "",
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: "#111",
          },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={shareArticle}
                style={styles.headerIconButton}
              >
                <Ionicons
                  name="share-social-outline"
                  size={22}
                  color="#fff"
                />
              </Pressable>

              <Pressable
                onPress={handleToggleSaved}
                style={styles.headerIconButton}
                disabled={isSaving}
              >
                <Ionicons
                  name={
                    isSaved
                      ? "bookmark"
                      : "bookmark-outline"
                  }
                  size={22}
                  color="#fff"
                />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() =>
              void loadPost("manual")
            }
          />
        }
      >
        {post.image ? (
          <View>
            <Image
              source={{ uri: post.image }}
              style={styles.heroImage}
              contentFit="cover"
              transition={250}
              cachePolicy="memory-disk"
              recyclingKey={String(post.id)}
            />

            {post.imageCaption ? (
              <Text style={styles.imageCaption}>
                {post.imageCaption}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.articleCard}>
          <View style={styles.metaRow}>
            <Text style={styles.category}>
              {post.category}
            </Text>
            <Text style={styles.date}>
              {formatDisplayDate(post.date)}
            </Text>
          </View>

          <Text style={styles.title}>
            {post.title}
          </Text>

          {post.author ? (
            <Text style={styles.byline}>
              By {post.author}
            </Text>
          ) : null}

          {post.modified &&
          post.modified !== post.date ? (
            <Text style={styles.updatedText}>
              Updated{" "}
              {formatDisplayDate(post.modified)}
            </Text>
          ) : null}

          {errorMessage ? (
            <Text style={styles.centerText}>
              {errorMessage}
            </Text>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.actionButton,
                isSaved
                  ? styles.savedButton
                  : styles.unsavedButton,
              ]}
              onPress={handleToggleSaved}
              disabled={isSaving}
            >
              <Ionicons
                name={
                  isSaved
                    ? "bookmark"
                    : "bookmark-outline"
                }
                size={18}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>
                {isSaved ? "Saved" : "Save"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.shareButton}
              onPress={shareArticle}
            >
              <Ionicons
                name="share-social-outline"
                size={18}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>
                Share
              </Text>
            </Pressable>
          </View>

          <DynamicArticleAds
            rules={belowHeadlineRules}
          />

          <View style={styles.divider} />

          {htmlSegments.length ? (
            htmlSegments.map((segment) => (
              <React.Fragment key={segment.id}>
                <HtmlArticle
                  html={segment.content}
                  width={htmlWidth}
                />

                <DynamicArticleAds
                  rules={getAfterParagraphRules(
                    adRules,
                    segment.paragraphNumber
                  )}
                />
              </React.Fragment>
            ))
          ) : textSegments.length ? (
            textSegments.map((segment) => (
              <React.Fragment key={segment.id}>
                <Text style={styles.body}>
                  {segment.content}
                </Text>

                <DynamicArticleAds
                  rules={getAfterParagraphRules(
                    adRules,
                    segment.paragraphNumber
                  )}
                />
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.body}>
              No article text available.
            </Text>
          )}

          <DynamicArticleAds
            rules={endOfArticleRules}
          />

          {relatedPosts.length ? (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>
                Related Stories
              </Text>

              {relatedPosts.map((related) => (
                <RelatedStoryCard
                  key={String(related.id)}
                  post={related}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#111",
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    backgroundColor: "#f6f6f6",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "#f6f6f6",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flex: 1,
  },
  content: {
    paddingBottom: 36,
  },
  centerText: {
    color: "#666",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  notFoundTitle: {
    color: "#111",
    fontSize: 26,
    fontWeight: "900",
  },
  backButtonLarge: {
    backgroundColor: "#b00020",
    borderRadius: 14,
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonLargeText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    marginRight: 6,
  },
  headerIconButton: {
    marginLeft: 14,
  },
  heroImage: {
    backgroundColor: "#ddd",
    height: 260,
    width: "100%",
  },
  imageCaption: {
    backgroundColor: "#eeeeee",
    color: "#555",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  articleCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  category: {
    color: "#b00020",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  date: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    color: "#111",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.4,
    lineHeight: 38,
  },
  byline: {
    color: "#444",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },
  updatedText: {
    color: "#777",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 5,
  },
  divider: {
    backgroundColor: "#e4e4e4",
    height: 1,
    marginBottom: 22,
    width: "100%",
  },
  body: {
    color: "#222",
    fontSize: 18,
    lineHeight: 31,
    marginBottom: 24,
  },
  relatedSection: {
    marginTop: 16,
  },
  relatedTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 16,
  },
  relatedCard: {
    backgroundColor: "#f7f7f7",
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  relatedImage: {
    height: 180,
    width: "100%",
  },
  relatedContent: {
    padding: 14,
  },
  relatedCategory: {
    color: "#b00020",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  relatedHeadline: {
    color: "#111",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  actionRow: {
    flexDirection: "row",
    marginBottom: 18,
    marginTop: 18,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    marginRight: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  savedButton: {
    backgroundColor: "#b00020",
  },
  unsavedButton: {
    backgroundColor: "#444",
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: "#1f6ed4",
    borderRadius: 999,
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 8,
  },
});