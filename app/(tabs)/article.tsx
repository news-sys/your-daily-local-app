import { Ionicons } from "@expo/vector-icons";
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
  LegacyAdPlacement,
} from "@/data/adSlots";
import {
  getArticlePlacementRules,
} from "@/services/ads";
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

const ARTICLE_BACKGROUND_REFRESH_MS =
  60 * 1000;

const YDL_BASE_URL =
  "https://yourdailylocal.com";

type ArticleLoadMode =
  | "initial"
  | "manual"
  | "background";

type ArticleSegment = {
  id: string;
  content: string;
  paragraphNumber: number;
};

const LEGACY_ARTICLE_FALLBACK_RULES: AdPlacementRule[] =
  [
    {
      id: "legacy-premium-article",
      key: "legacy-premium-article",
      placement: "premium-article",
      active: true,
      priority: 100,
      surfaces: ["article"],
      contentTargets: ["all"],
      articlePosition: {
        type: "below-headline",
      },
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

function cleanArticleHtml(
  html = ""
): string {
  if (!html.trim()) {
    return "";
  }

  return html
    .replace(
      /<!--more-->/gi,
      ""
    )
    .replace(
      /<!--[\s\S]*?-->/g,
      ""
    )
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
  html: string
): ArticleSegment[] {
  const cleaned =
    cleanArticleHtml(
      html
    );

  if (!cleaned) {
    return [];
  }

  const segments: ArticleSegment[] =
    [];

  const paragraphEndPattern =
    /<\/p\s*>/gi;

  let match:
    | RegExpExecArray
    | null = null;

  let startIndex = 0;
  let paragraphNumber = 0;

  while (
    (match =
      paragraphEndPattern.exec(
        cleaned
      )) !== null
  ) {
    paragraphNumber += 1;

    const endIndex =
      match.index +
      match[0].length;

    const segment =
      cleaned
        .slice(
          startIndex,
          endIndex
        )
        .trim();

    if (segment) {
      segments.push({
        id: `html-${paragraphNumber}`,
        content: segment,
        paragraphNumber,
      });
    }

    startIndex =
      endIndex;
  }

  const remainder =
    cleaned
      .slice(
        startIndex
      )
      .trim();

  if (remainder) {
    segments.push({
      id: `html-${paragraphNumber + 1}`,
      content: remainder,
      paragraphNumber:
        paragraphNumber + 1,
    });
  }

  if (
    segments.length === 0
  ) {
    return [
      {
        id: "html-1",
        content: cleaned,
        paragraphNumber: 1,
      },
    ];
  }

  return segments;
}

function splitTextIntoSegments(
  text: string
): ArticleSegment[] {
  return text
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        paragraph.trim()
    )
    .filter(Boolean)
    .map(
      (
        paragraph,
        index
      ) => ({
        id: `text-${index + 1}`,
        content: paragraph,
        paragraphNumber:
          index + 1,
      })
    );
}

function getArticleContentTarget(
  category?: string
): AdRuleContentTarget {
  const normalized =
    category
      ?.trim()
      .toLowerCase() ??
    "";

  if (
    normalized.includes(
      "sports"
    )
  ) {
    return "sports";
  }

  if (
    normalized.includes(
      "forest"
    )
  ) {
    return "forest-county-news";
  }

  if (
    normalized.includes(
      "breaking"
    )
  ) {
    return "breaking";
  }

  if (
    normalized.includes(
      "live video"
    ) ||
    normalized.includes(
      "live-video"
    )
  ) {
    return "live-video";
  }

  return "news";
}

function getBelowHeadlineRules(
  rules: AdPlacementRule[]
): AdPlacementRule[] {
  return rules.filter(
    (rule) =>
      rule.articlePosition
        ?.type ===
      "below-headline"
  );
}

function getAfterParagraphRules(
  rules: AdPlacementRule[],
  paragraphNumber: number
): AdPlacementRule[] {
  return rules.filter(
    (rule) =>
      rule.articlePosition
        ?.type ===
        "after-paragraph" &&
      rule.articlePosition
        .paragraphNumber ===
        paragraphNumber
  );
}

function getEndOfArticleRules(
  rules: AdPlacementRule[]
): AdPlacementRule[] {
  return rules.filter(
    (rule) =>
      rule.articlePosition
        ?.type ===
      "end-of-article"
  );
}

function hasPostChanged(
  currentPost:
    | Post
    | undefined,
  nextPost: Post
): boolean {
  if (!currentPost) {
    return true;
  }

  if (
    currentPost.modified &&
    nextPost.modified &&
    currentPost.modified !==
      nextPost.modified
  ) {
    return true;
  }

  return (
    currentPost.title !==
      nextPost.title ||
    currentPost.excerpt !==
      nextPost.excerpt ||
    currentPost.body !==
      nextPost.body ||
    currentPost.bodyHtml !==
      nextPost.bodyHtml ||
    currentPost.image !==
      nextPost.image ||
    currentPost.imageCaption !==
      nextPost.imageCaption
  );
}

function buildHtmlDocument(
  bodyHtml: string
): string {
  return `<!doctype html>
<html>
<head>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1"
  />
  <style>
    * {
      box-sizing: border-box;
    }

    html,
    body {
      background: transparent;
      margin: 0;
      padding: 0;
    }

    body {
      color: #222;
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Arial,
        sans-serif;
      font-size: 18px;
      line-height: 1.72;
      overflow-wrap: anywhere;
    }

    p {
      margin: 0 0 24px;
    }

    p:empty,
    div:empty,
    figure:empty,
    section:empty {
      display: none !important;
      height: 0 !important;
      margin: 0 !important;
      min-height: 0 !important;
      padding: 0 !important;
    }

    .wp-block-spacer,
    .advertisement,
    .ad-placeholder,
    .ad-container,
    .adsbygoogle {
      display: none !important;
      height: 0 !important;
      margin: 0 !important;
      min-height: 0 !important;
      padding: 0 !important;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      color: #111;
      line-height: 1.25;
      margin: 28px 0 14px;
    }

    h1 {
      font-size: 30px;
    }

    h2 {
      font-size: 26px;
    }

    h3 {
      font-size: 22px;
    }

    a {
      color: #b00020;
      font-weight: 700;
      text-decoration: underline;
    }

    ul,
    ol {
      margin: 0 0 24px;
      padding-left: 26px;
    }

    li {
      margin-bottom: 8px;
    }

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

    figure {
      margin: 20px 0;
      max-width: 100%;
    }

    figcaption {
      color: #666;
      font-size: 13px;
      font-style: italic;
      line-height: 1.45;
      margin-top: 8px;
    }

    iframe,
    video {
      border: 0;
      display: block;
      max-width: 100%;
      width: 100%;
    }

    .wp-block-embed__wrapper {
      position: relative;
      width: 100%;
    }

    table {
      border-collapse: collapse;
      display: block;
      margin: 18px 0 24px;
      max-width: 100%;
      overflow-x: auto;
      white-space: nowrap;
      width: 100%;
    }

    th,
    td {
      border: 1px solid #ccc;
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f1f1f1;
      font-weight: 800;
    }

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
  ${bodyHtml}

  <script>
    function removeEmptyBlocks() {
      const selectors = [
        "p",
        "div",
        "section",
        "figure"
      ];

      document
        .querySelectorAll(
          selectors.join(",")
        )
        .forEach(function (element) {
          const hasVisibleMedia =
            element.querySelector(
              "img, iframe, video, table, ul, ol, blockquote"
            );

          const text =
            (
              element.textContent ||
              ""
            )
              .replace(/\\u00a0/g, "")
              .trim();

          if (
            !text &&
            !hasVisibleMedia
          ) {
            element.remove();
          }
        });
    }

    function sendHeight() {
      removeEmptyBlocks();

      const bodyHeight =
        document.body
          .getBoundingClientRect()
          .height;

      const documentHeight =
        document.documentElement
          .getBoundingClientRect()
          .height;

      const height =
        Math.ceil(
          Math.max(
            bodyHeight,
            documentHeight,
            1
          )
        );

      window.ReactNativeWebView
        .postMessage(
          JSON.stringify({
            type: "height",
            height: height
          })
        );
    }

    window.addEventListener(
      "load",
      sendHeight
    );

    window.addEventListener(
      "resize",
      sendHeight
    );

    document
      .querySelectorAll("img")
      .forEach(function (image) {
        image.addEventListener(
          "load",
          sendHeight
        );

        image.addEventListener(
          "error",
          sendHeight
        );
      });

    setTimeout(sendHeight, 100);
    setTimeout(sendHeight, 400);
    setTimeout(sendHeight, 1000);
    setTimeout(sendHeight, 2000);
  </script>
</body>
</html>`;
}

const HtmlArticle = memo(
  function HtmlArticle({
    html,
    width,
  }: {
    html: string;
    width: number;
  }) {
    const [
      height,
      setHeight,
    ] = useState(1);

    const document =
      useMemo(
        () =>
          buildHtmlDocument(
            cleanArticleHtml(
              html
            )
          ),
        [html]
      );

    const initialLoadRef =
      useRef(true);

    return (
      <WebView
        source={{
          html: document,
          baseUrl:
            YDL_BASE_URL,
        }}
        style={{
          width,
          height,
          backgroundColor:
            "transparent",
        }}
        originWhitelist={[
          "*",
        ]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsVerticalScrollIndicator={
          false
        }
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        setSupportMultipleWindows={
          false
        }
        onMessage={(
          event
        ) => {
          try {
            const message =
              JSON.parse(
                event.nativeEvent
                  .data
              ) as {
                type?: string;
                height?: number;
              };

            if (
              message.type ===
                "height" &&
              typeof message.height ===
                "number" &&
              Number.isFinite(
                message.height
              )
            ) {
              setHeight(
                Math.max(
                  1,
                  Math.ceil(
                    message.height
                  )
                )
              );
            }
          } catch {
            // Ignore unrelated WebView messages.
          }
        }}
        onShouldStartLoadWithRequest={(
          request
        ) => {
          const url =
            request.url;

          if (
            initialLoadRef.current
          ) {
            initialLoadRef.current =
              false;

            return true;
          }

          if (
            url ===
              "about:blank" ||
            url.startsWith(
              "data:text/html"
            ) ||
            url ===
              YDL_BASE_URL ||
            url ===
              `${YDL_BASE_URL}/`
          ) {
            return true;
          }

          if (
            /^https?:\/\//i.test(
              url
            )
          ) {
            void Linking.openURL(
              url
            );

            return false;
          }

          return true;
        }}
      />
    );
  }
);

const RelatedStoryCard =
  memo(
    function RelatedStoryCard({
      post,
    }: {
      post: Post;
    }) {
      return (
        <Pressable
          style={
            styles.relatedCard
          }
          onPress={() =>
            router.push({
              pathname:
                "/(tabs)/article",
              params: {
                id: String(
                  post.id
                ),
                fresh: "1",
              },
            })
          }
        >
          {post.image ? (
            <Image
              source={{
                uri:
                  post.image,
              }}
              style={
                styles.relatedImage
              }
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              recyclingKey={String(
                post.id
              )}
            />
          ) : null}

          <View
            style={
              styles.relatedContent
            }
          >
            <Text
              style={
                styles.relatedCategory
              }
            >
              {post.category}
            </Text>

            <Text
              style={
                styles.relatedHeadline
              }
            >
              {post.title}
            </Text>
          </View>
        </Pressable>
      );
    }
  );

function isLegacyPlacement(
  value: string
): value is LegacyAdPlacement {
  return (
    value ===
      "presenting-home" ||
    value ===
      "presenting-feed" ||
    value ===
      "premium-home" ||
    value ===
      "premium-article" ||
    value ===
      "featured-home" ||
    value ===
      "featured-article" ||
    value ===
      "legacy-rotation"
  );
}

function DynamicArticleAds({
  rules,
}: {
  rules: AdPlacementRule[];
}) {
  if (
    rules.length === 0
  ) {
    return null;
  }

  return (
    <>
      {rules.map(
        (rule) => {
          if (
            rule.rotationKey
          ) {
            return (
              <RotatingAdSlot
                key={[
                  rule.id,
                  rule.key,
                ].join("-")}
                rotationSlug={
                  rule.rotationKey
                }
                trackingPlacement={
                  rule.key
                }
                rotationIntervalMs={
                  rule.rotationIntervalMs
                }
              />
            );
          }

          if (
            isLegacyPlacement(
              rule.placement
            )
          ) {
            return (
              <RotatingAdSlot
                key={[
                  rule.id,
                  rule.placement,
                ].join("-")}
                placement={
                  rule.placement
                }
              />
            );
          }

          return null;
        }
      )}
    </>
  );
}

export default function ArticleScreen() {
  const params =
    useLocalSearchParams<{
      id?: string;
      fresh?: string;
      source?: string;
    }>();

  const id =
    params.id;

  const {
    width: windowWidth,
  } = useWindowDimensions();

  const trackedArticleIdRef =
    useRef<
      number | null
    >(null);

  const activeLoadIdRef =
    useRef(0);

  const currentPostRef =
    useRef<
      Post | undefined
    >(undefined);

  const [
    post,
    setPost,
  ] =
    useState<
      Post | undefined
    >();

  const [
    relatedPosts,
    setRelatedPosts,
  ] =
    useState<Post[]>([]);

  const [
    adRules,
    setAdRules,
  ] =
    useState<
      AdPlacementRule[]
    >(
      LEGACY_ARTICLE_FALLBACK_RULES
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    isSaved,
    setIsSaved,
  ] =
    useState(false);

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  const htmlSegments =
    useMemo(
      () =>
        splitHtmlIntoSegments(
          post?.bodyHtml ??
            ""
        ),
      [
        post?.bodyHtml,
      ]
    );

  const textSegments =
    useMemo(
      () =>
        splitTextIntoSegments(
          post?.body ??
            ""
        ),
      [
        post?.body,
      ]
    );

  const htmlWidth =
    Math.max(
      240,
      windowWidth - 44
    );

  const belowHeadlineRules =
    useMemo(
      () =>
        getBelowHeadlineRules(
          adRules
        ),
      [
        adRules,
      ]
    );

  const endOfArticleRules =
    useMemo(
      () =>
        getEndOfArticleRules(
          adRules
        ),
      [
        adRules,
      ]
    );

  const loadAdRules =
    useCallback(
      async (
        result: Post,
        forceRefresh: boolean
      ) => {
        const target =
          getArticleContentTarget(
            result.category
          );

        try {
          const rules =
            await getArticlePlacementRules(
              target,
              forceRefresh
            );

          if (
            rules.length >
            0
          ) {
            setAdRules(
              rules
            );
          } else {
            setAdRules(
              LEGACY_ARTICLE_FALLBACK_RULES
            );
          }
        } catch {
          setAdRules(
            LEGACY_ARTICLE_FALLBACK_RULES
          );
        }
      },
      []
    );

  const applyPostResult =
    useCallback(
      async (
        result: Post,
        forceRelatedRefresh: boolean,
        shouldUpdatePost: boolean
      ) => {
        if (
          shouldUpdatePost
        ) {
          currentPostRef.current =
            result;

          setPost(
            result
          );
        }

        if (
          trackedArticleIdRef.current !==
          result.id
        ) {
          trackArticleOpen(
            result.id,
            result.title
          );

          trackedArticleIdRef.current =
            result.id;
        }

        const [
          saved,
          related,
        ] =
          await Promise.all([
            isPostSaved(
              result.id
            ),
            result.category
              ? getPostsByCategory(
                  result.category,
                  1,
                  {
                    forceRefresh:
                      forceRelatedRefresh,
                  }
                )
              : Promise.resolve(
                  null
                ),
          ]);

        setIsSaved(
          saved
        );

        setRelatedPosts(
          related
            ? related.posts
                .filter(
                  (
                    relatedPost
                  ) =>
                    relatedPost.id !==
                    result.id
                )
                .slice(
                  0,
                  3
                )
            : []
        );

        void loadAdRules(
          result,
          forceRelatedRefresh
        );
      },
      [
        loadAdRules,
      ]
    );

  const loadPost =
    useCallback(
      async (
        mode: ArticleLoadMode =
          "initial"
      ) => {
        if (!id) {
          setIsLoading(
            false
          );

          return;
        }

        const loadId =
          ++activeLoadIdRef.current;

        const forceRefresh =
          mode !==
          "initial";

        try {
          if (
            mode ===
            "initial"
          ) {
            setIsLoading(
              true
            );
          } else if (
            mode ===
            "manual"
          ) {
            setIsRefreshing(
              true
            );
          }

          if (
            mode !==
            "background"
          ) {
            setErrorMessage(
              null
            );
          }

          const result =
            await getPostById(
              id,
              {
                forceRefresh,
              }
            );

          if (
            loadId !==
              activeLoadIdRef.current ||
            !result
          ) {
            return;
          }

          const currentPost =
            currentPostRef.current;

          const shouldUpdatePost =
            mode !==
              "background" ||
            hasPostChanged(
              currentPost,
              result
            );

          await applyPostResult(
            result,
            forceRefresh,
            shouldUpdatePost
          );
        } catch {
          if (
            loadId !==
            activeLoadIdRef.current
          ) {
            return;
          }

          if (
            mode !==
              "background" &&
            !currentPostRef.current
          ) {
            setErrorMessage(
              "Unable to load the latest version of this story."
            );
          }
        } finally {
          if (
            loadId ===
            activeLoadIdRef.current
          ) {
            if (
              mode ===
              "initial"
            ) {
              setIsLoading(
                false
              );
            }

            if (
              mode ===
              "manual"
            ) {
              setIsRefreshing(
                false
              );
            }
          }
        }
      },
      [
        applyPostResult,
        id,
      ]
    );

  useEffect(() => {
    void loadPost(
      "initial"
    );

    const intervalId =
      setInterval(() => {
        void loadPost(
          "background"
        );
      }, ARTICLE_BACKGROUND_REFRESH_MS);

    return () => {
      activeLoadIdRef.current +=
        1;

      clearInterval(
        intervalId
      );
    };
  }, [
    loadPost,
  ]);

  const shareArticle =
    useCallback(
      async () => {
        if (!post) {
          return;
        }

        try {
          await Share.share({
            title:
              post.title,
            message:
              post.link
                ? `${post.title}\n\n${post.link}`
                : `${post.title}\n\nShared from Your Daily Local`,
          });

          trackSharedStory(
            post.id,
            post.title
          );
        } catch {
          // Share canceled.
        }
      },
      [
        post,
      ]
    );

  const handleToggleSaved =
    useCallback(
      async () => {
        if (
          !post ||
          isSaving
        ) {
          return;
        }

        try {
          setIsSaving(
            true
          );

          const nextSavedState =
            await toggleSavedPost(
              post
            );

          setIsSaved(
            nextSavedState
          );

          if (
            nextSavedState
          ) {
            trackSavedStory(
              post.id,
              post.title
            );
          }
        } finally {
          setIsSaving(
            false
          );
        }
      },
      [
        isSaving,
        post,
      ]
    );

  if (isLoading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          "top",
          "left",
          "right",
        ]}
      >
        <StatusBar
          style="light"
        />

        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
          />

          <Text
            style={
              styles.centerText
            }
          >
            Loading the latest story...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          "top",
          "left",
          "right",
        ]}
      >
        <StatusBar
          style="light"
        />

        <View
          style={
            styles.loadingContainer
          }
        >
          <Text
            style={
              styles.notFoundTitle
            }
          >
            Story not found
          </Text>

          <Text
            style={
              styles.centerText
            }
          >
            {errorMessage ??
              "This story could not be loaded."}
          </Text>

          <Pressable
            style={
              styles.backButtonLarge
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonLargeText
              }
            >
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <StatusBar
        style="light"
      />

      <Stack.Screen
        options={{
          title: "",
          headerShadowVisible:
            false,
          headerStyle: {
            backgroundColor:
              "#111",
          },
          headerTintColor:
            "#fff",
          headerRight: () => (
            <View
              style={
                styles.headerActions
              }
            >
              <Pressable
                onPress={
                  shareArticle
                }
                style={
                  styles.headerIconButton
                }
              >
                <Ionicons
                  name="share-social-outline"
                  size={22}
                  color="#fff"
                />
              </Pressable>

              <Pressable
                onPress={
                  handleToggleSaved
                }
                style={
                  styles.headerIconButton
                }
                disabled={
                  isSaving
                }
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
        style={
          styles.container
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              isRefreshing
            }
            onRefresh={() =>
              void loadPost(
                "manual"
              )
            }
          />
        }
      >
        {post.image ? (
          <View>
            <Image
              source={{
                uri:
                  post.image,
              }}
              style={
                styles.heroImage
              }
              contentFit="cover"
              transition={250}
              cachePolicy="memory-disk"
              recyclingKey={String(
                post.id
              )}
            />

            {post.imageCaption ? (
              <Text
                style={
                  styles.imageCaption
                }
              >
                {post.imageCaption}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={
            styles.articleCard
          }
        >
          <View
            style={
              styles.metaRow
            }
          >
            <Text
              style={
                styles.category
              }
            >
              {post.category}
            </Text>

            <Text
              style={
                styles.date
              }
            >
              {formatDisplayDate(
                post.date
              )}
            </Text>
          </View>

          <Text
            style={
              styles.title
            }
          >
            {post.title}
          </Text>

          {post.author ? (
            <Text
              style={
                styles.byline
              }
            >
              By {post.author}
            </Text>
          ) : null}

          {post.modified &&
          post.modified !==
            post.date ? (
            <Text
              style={
                styles.updatedText
              }
            >
              Updated{" "}
              {formatDisplayDate(
                post.modified
              )}
            </Text>
          ) : null}

          <View
            style={
              styles.actionRow
            }
          >
            <Pressable
              style={[
                styles.actionButton,
                isSaved
                  ? styles.savedButton
                  : styles.unsavedButton,
              ]}
              onPress={
                handleToggleSaved
              }
              disabled={
                isSaving
              }
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

              <Text
                style={
                  styles.actionButtonText
                }
              >
                {isSaved
                  ? "Saved"
                  : "Save"}
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.shareButton
              }
              onPress={
                shareArticle
              }
            >
              <Ionicons
                name="share-social-outline"
                size={18}
                color="#fff"
              />

              <Text
                style={
                  styles.actionButtonText
                }
              >
                Share
              </Text>
            </Pressable>
          </View>

          <DynamicArticleAds
            rules={
              belowHeadlineRules
            }
          />

          <View
            style={
              styles.divider
            }
          />

          {htmlSegments.length >
          0 ? (
            <>
              {htmlSegments.map(
                (
                  segment
                ) => {
                  const rules =
                    getAfterParagraphRules(
                      adRules,
                      segment.paragraphNumber
                    );

                  return (
                    <React.Fragment
                      key={
                        segment.id
                      }
                    >
                      <HtmlArticle
                        html={
                          segment.content
                        }
                        width={
                          htmlWidth
                        }
                      />

                      <DynamicArticleAds
                        rules={
                          rules
                        }
                      />
                    </React.Fragment>
                  );
                }
              )}
            </>
          ) : textSegments.length >
            0 ? (
            <>
              {textSegments.map(
                (
                  segment
                ) => {
                  const rules =
                    getAfterParagraphRules(
                      adRules,
                      segment.paragraphNumber
                    );

                  return (
                    <React.Fragment
                      key={
                        segment.id
                      }
                    >
                      <Text
                        style={
                          styles.body
                        }
                      >
                        {
                          segment.content
                        }
                      </Text>

                      <DynamicArticleAds
                        rules={
                          rules
                        }
                      />
                    </React.Fragment>
                  );
                }
              )}
            </>
          ) : (
            <Text
              style={
                styles.body
              }
            >
              No article text available.
            </Text>
          )}

          <DynamicArticleAds
            rules={
              endOfArticleRules
            }
          />

          {relatedPosts.length >
          0 ? (
            <View
              style={
                styles.relatedSection
              }
            >
              <Text
                style={
                  styles.relatedTitle
                }
              >
                Related Stories
              </Text>

              {relatedPosts.map(
                (
                  relatedPost
                ) => (
                  <RelatedStoryCard
                    key={String(
                      relatedPost.id
                    )}
                    post={
                      relatedPost
                    }
                  />
                )
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      backgroundColor:
        "#111",
      flex: 1,
    },

    loadingContainer: {
      alignItems:
        "center",
      backgroundColor:
        "#f6f6f6",
      borderTopLeftRadius:
        18,
      borderTopRightRadius:
        18,
      flex: 1,
      justifyContent:
        "center",
      padding: 24,
    },

    container: {
      backgroundColor:
        "#f6f6f6",
      borderTopLeftRadius:
        18,
      borderTopRightRadius:
        18,
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
      textAlign:
        "center",
    },

    notFoundTitle: {
      color: "#111",
      fontSize: 26,
      fontWeight: "900",
    },

    backButtonLarge: {
      backgroundColor:
        "#b00020",
      borderRadius: 14,
      marginTop: 22,
      paddingHorizontal:
        20,
      paddingVertical:
        12,
    },

    backButtonLargeText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "800",
    },

    headerActions: {
      alignItems:
        "center",
      flexDirection:
        "row",
      marginRight: 6,
    },

    headerIconButton: {
      marginLeft: 14,
    },

    heroImage: {
      backgroundColor:
        "#ddd",
      height: 260,
      width: "100%",
    },

    imageCaption: {
      backgroundColor:
        "#eeeeee",
      color: "#555",
      fontSize: 12,
      fontStyle:
        "italic",
      lineHeight: 17,
      paddingHorizontal:
        14,
      paddingVertical: 9,
    },

    articleCard: {
      backgroundColor:
        "#fff",
      borderTopLeftRadius:
        22,
      borderTopRightRadius:
        22,
      padding: 22,
    },

    metaRow: {
      alignItems:
        "center",
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      marginBottom: 14,
    },

    category: {
      color: "#b00020",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.7,
      textTransform:
        "uppercase",
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
      fontStyle:
        "italic",
      marginTop: 5,
    },

    divider: {
      backgroundColor:
        "#e4e4e4",
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
      backgroundColor:
        "#f7f7f7",
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
      textTransform:
        "uppercase",
    },

    relatedHeadline: {
      color: "#111",
      fontSize: 18,
      fontWeight: "800",
      lineHeight: 24,
    },

    actionRow: {
      flexDirection:
        "row",
      marginBottom: 18,
      marginTop: 18,
    },

    actionButton: {
      alignItems:
        "center",
      borderRadius: 999,
      flexDirection:
        "row",
      marginRight: 12,
      paddingHorizontal:
        18,
      paddingVertical:
        12,
    },

    savedButton: {
      backgroundColor:
        "#b00020",
    },

    unsavedButton: {
      backgroundColor:
        "#444",
    },

    shareButton: {
      alignItems:
        "center",
      backgroundColor:
        "#1f6ed4",
      borderRadius: 999,
      flexDirection:
        "row",
      paddingHorizontal:
        18,
      paddingVertical:
        12,
    },

    actionButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "800",
      marginLeft: 8,
    },
  });
