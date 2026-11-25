import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import RotatingAdSlot from "@/components/RotatingAdSlot";
import {
  trackEvent,
  trackScreenView,
} from "@/services/analytics";
import {
  getBreakingPosts,
  getHomepageSections,
} from "@/services/api";
import type { HomeSection } from "@/types/HomeSection";
import type { Post } from "@/types/Post";
import { formatDisplayDate } from "@/utils/formatDisplayDate";

const logo = require("@/assets/images/ydl-logo.png");

const HOME_FOCUS_REFRESH_MS = 60 * 1000;
const BACK_TO_TOP_THRESHOLD = 700;

type HomeLoadMode = "initial" | "manual" | "background";

type HomeAdPlacement =
  | "premium-home"
  | "featured-home"
  | "legacy-rotation";

function getAdPlacementAfterSection(
  section: HomeSection
): HomeAdPlacement | null {
  if (section.id === "top-story") return "premium-home";
  if (section.id === "latest-news") return "featured-home";
  if (section.id === "sports") return "legacy-rotation";
  return null;
}

function hasVisibleStories(sections: HomeSection[]): boolean {
  return sections.some((section) => section.posts.length > 0);
}

function mergeHomeSections(
  previousSections: HomeSection[],
  refreshedSections: HomeSection[]
): HomeSection[] {
  if (previousSections.length === 0) {
    return refreshedSections;
  }

  const previousById = new Map(
    previousSections.map((section) => [
      section.id,
      section,
    ])
  );

  return refreshedSections.map((section) => {
    const previous = previousById.get(section.id);

    if (
      section.type !== "ad" &&
      section.posts.length === 0 &&
      previous &&
      previous.posts.length > 0
    ) {
      return {
        ...section,
        posts: previous.posts,
      };
    }

    return section;
  });
}

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);

  const [sections, setSections] = useState<HomeSection[]>([]);
  const [breakingPosts, setBreakingPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null
  );
  const [showBackToTop, setShowBackToTop] = useState(false);

  const sectionsRef = useRef<HomeSection[]>([]);
  const hasTrackedScreenViewRef = useRef(false);
  const hasCompletedInitialLoadRef = useRef(false);
  const hasReceivedInitialFocusRef = useRef(false);
  const isHomeLoadingRef = useRef(false);
  const isBreakingLoadingRef = useRef(false);
  const lastRefreshRef = useRef(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const shouldShow =
        event.nativeEvent.contentOffset.y >=
        BACK_TO_TOP_THRESHOLD;

      setShowBackToTop((current) =>
        current === shouldShow ? current : shouldShow
      );
    },
    []
  );

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, []);

  const loadBreaking = useCallback(
    async (mode: HomeLoadMode = "initial") => {
      if (isBreakingLoadingRef.current) return;

      isBreakingLoadingRef.current = true;
      const forceRefresh = mode !== "initial";

      try {
        const breaking = await getBreakingPosts(1, {
          forceRefresh,
        });

        setBreakingPosts(breaking.posts);
      } catch (error) {
        console.warn(
          "[Home] Breaking news refresh failed:",
          error
        );

        // Breaking news must not block the Home feed.
        // Keep previously loaded stories if the request fails.
      } finally {
        isBreakingLoadingRef.current = false;
      }
    },
    []
  );

  const loadHome = useCallback(
    async (mode: HomeLoadMode = "initial") => {
      if (isHomeLoadingRef.current) return;

      isHomeLoadingRef.current = true;
      const forceRefresh = mode !== "initial";

      try {
        if (mode === "initial") {
          setIsLoading(true);
        } else if (mode === "manual") {
          setIsRefreshing(true);
        }

        if (mode !== "background") {
          setErrorMessage(null);
        }

        const homeSections = await getHomepageSections({
          forceRefresh,
        });

        const mergedSections = mergeHomeSections(
          sectionsRef.current,
          homeSections
        );

        if (hasVisibleStories(mergedSections)) {
          sectionsRef.current = mergedSections;
          setSections(mergedSections);
          setErrorMessage(null);

          lastRefreshRef.current = Date.now();
          hasCompletedInitialLoadRef.current = true;
        } else {
          console.warn(
            "[Home] Request returned no visible stories."
          );

          if (
            !hasVisibleStories(sectionsRef.current) &&
            mode !== "background"
          ) {
            setErrorMessage(
              "Unable to load the latest Home feed. Pull down to try again."
            );
          }
        }
      } catch (error) {
        console.warn("[Home] Feed request failed:", error);

        if (
          mode !== "background" &&
          !hasVisibleStories(sectionsRef.current)
        ) {
          setErrorMessage(
            "Unable to load the latest Home feed. Pull down to try again."
          );
        }
      } finally {
        isHomeLoadingRef.current = false;

        if (mode === "initial") {
          setIsLoading(false);
        }

        if (mode === "manual") {
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  const refreshHomeAndBreaking = useCallback(
    async (mode: HomeLoadMode) => {
      await Promise.all([
        loadHome(mode),
        loadBreaking(mode),
      ]);
    },
    [loadBreaking, loadHome]
  );

  useEffect(() => {
    if (!hasTrackedScreenViewRef.current) {
      trackScreenView("home");
      hasTrackedScreenViewRef.current = true;
    }

    // Start both requests independently.
    // Do not repeat them immediately after initial loading.
    void loadHome("initial");
    void loadBreaking("initial");
  }, [loadHome, loadBreaking]);

  useFocusEffect(
    useCallback(() => {
      if (!hasReceivedInitialFocusRef.current) {
        hasReceivedInitialFocusRef.current = true;
        return;
      }

      if (!hasCompletedInitialLoadRef.current) {
        return;
      }

      const timeSinceRefresh =
        Date.now() - lastRefreshRef.current;

      if (timeSinceRefresh >= HOME_FOCUS_REFRESH_MS) {
        void refreshHomeAndBreaking("background");
      }
    }, [refreshHomeAndBreaking])
  );

  const openBreakingStory = useCallback(() => {
    const breakingStory = breakingPosts[0];

    if (!breakingStory) return;

    trackEvent("article_open", {
      source: "home_breaking_bar_tap",
      postId: breakingStory.id,
      title: breakingStory.title,
    });

    router.push({
      pathname: "/(tabs)/article",
      params: {
        id: String(breakingStory.id),
        fresh: "1",
        source: "breaking",
      },
    });
  }, [breakingPosts]);

  if (isLoading && sections.length === 0) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right"]}
      >
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <Image
            source={logo}
            style={styles.loadingLogo}
            resizeMode="contain"
          />

          <ActivityIndicator size="small" />

          <Text style={styles.centerText}>
            Loading Your Daily Local...
          </Text>
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

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() =>
              void refreshHomeAndBreaking("manual")
            }
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.settingsButton}
            onPress={() => router.push("/settings")}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color="#666"
            />
          </Pressable>

          <Image
            source={logo}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.tagline}>
            The news you need, when you need it
          </Text>
        </View>

        <RotatingAdSlot
          placement="presenting-home"
          sponsorLabel="YDL App powered by"
        />

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {breakingPosts.length > 0 &&
        breakingPosts[0]?.category === "Breaking" ? (
          <Pressable
            style={styles.breakingBar}
            onPress={openBreakingStory}
          >
            <Text style={styles.breakingLabel}>
              Breaking
            </Text>

            <Text
              style={styles.breakingText}
              numberOfLines={1}
            >
              {breakingPosts[0].title}
            </Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#fff"
            />
          </Pressable>
        ) : null}

        {sections.map((section) => {
          const adPlacement =
            getAdPlacementAfterSection(section);

          return (
            <View key={section.id}>
              {section.type === "ad" ? null : section.type ===
                "lead" ? (
                <LeadSection section={section} />
              ) : (
                <ListSection section={section} />
              )}

              {adPlacement ? (
                <RotatingAdSlot placement={adPlacement} />
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {showBackToTop ? (
        <Pressable
          style={styles.backToTopButton}
          onPress={scrollToTop}
          accessibilityRole="button"
          accessibilityLabel="Back to top"
        >
          <Ionicons
            name="arrow-up"
            size={18}
            color="#fff"
          />

          <Text style={styles.backToTopText}>Top</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function LeadSection({
  section,
}: {
  section: HomeSection;
}) {
  const leadStory = section.posts[0];

  const openLeadStory = useCallback(() => {
    if (!leadStory) return;

    trackEvent("article_open", {
      source: "home_lead_section",
      sectionId: section.id,
      sectionTitle: section.title,
      postId: leadStory.id,
      title: leadStory.title,
    });

    router.push({
      pathname: "/(tabs)/article",
      params: {
        id: String(leadStory.id),
        fresh: "1",
      },
    });
  }, [leadStory, section.id, section.title]);

  if (!leadStory) return null;

  return (
    <>
      <Text style={styles.mainSectionTitle}>
        {section.title}
      </Text>

      <Pressable
        style={styles.leadCard}
        onPress={openLeadStory}
      >
        {leadStory.image ? (
          <Image
            source={{ uri: leadStory.image }}
            style={styles.leadImage}
          />
        ) : null}

        <View style={styles.leadBody}>
          <Text style={styles.leadTitle}>
            {leadStory.title}
          </Text>

          {leadStory.excerpt ? (
            <Text style={styles.excerpt}>
              {leadStory.excerpt}
            </Text>
          ) : null}

          {leadStory.date ? (
            <Text style={styles.date}>
              {formatDisplayDate(leadStory.date)}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </>
  );
}

function ListSection({
  section,
}: {
  section: HomeSection;
}) {
  const openSection = useCallback(() => {
    trackEvent("screen_view", {
      screenName: "home_view_all_tap",
      sectionId: section.id,
      sectionTitle: section.title,
      destination: section.slug,
    });

    router.push({
      pathname: "/(tabs)/category/[slug]",
      params: {
        slug: section.slug,
      },
    });
  }, [section.id, section.slug, section.title]);

  const openStory = useCallback(
    (post: Post) => {
      trackEvent("article_open", {
        source: "home_list_section",
        sectionId: section.id,
        sectionTitle: section.title,
        postId: post.id,
        title: post.title,
      });

      router.push({
        pathname: "/(tabs)/article",
        params: {
          id: String(post.id),
          fresh: "1",
        },
      });
    },
    [section.id, section.title]
  );

  if (section.posts.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {section.title}
        </Text>

        <Pressable onPress={openSection}>
          <Text style={styles.viewAllText}>
            View All
          </Text>
        </Pressable>
      </View>

      {section.posts.map((post) => (
        <Pressable
          key={String(post.id)}
          style={styles.storyRow}
          onPress={() => openStory(post)}
        >
          {post.image ? (
            <Image
              source={{ uri: post.image }}
              style={styles.thumbnail}
            />
          ) : null}

          <View style={styles.storyText}>
            {post.category ? (
              <Text style={styles.category}>
                {post.category}
              </Text>
            ) : null}

            <Text style={styles.storyTitle}>
              {post.title}
            </Text>

            {post.date ? (
              <Text style={styles.date}>
                {formatDisplayDate(post.date)}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
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
  loadingLogo: {
    height: 72,
    marginBottom: 18,
    width: 260,
  },
  container: {
    backgroundColor: "#f6f6f6",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 16,
  },
  centerText: {
    color: "#666",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 4,
  },
  settingsButton: {
    position: "absolute",
    right: 0,
    top: 8,
    zIndex: 10,
  },
  logo: {
    height: 72,
    width: 260,
  },
  tagline: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: "#fdecec",
    borderColor: "#f4b4b4",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  errorText: {
    color: "#8a1f1f",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  breakingBar: {
    alignItems: "center",
    backgroundColor: "#b00020",
    borderRadius: 14,
    flexDirection: "row",
    marginBottom: 16,
    padding: 12,
  },
  breakingLabel: {
    backgroundColor: "#fff",
    borderRadius: 8,
    color: "#b00020",
    fontSize: 12,
    fontWeight: "900",
    marginRight: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  breakingText: {
    color: "#fff",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    marginRight: 6,
  },
  mainSectionTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
  },
  leadCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 18,
    overflow: "hidden",
  },
  leadImage: {
    height: 220,
    width: "100%",
  },
  leadBody: {
    padding: 16,
  },
  leadTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  excerpt: {
    color: "#555",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  section: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#111",
    fontSize: 22,
    fontWeight: "900",
  },
  viewAllText: {
    color: "#b00020",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  storyRow: {
    backgroundColor: "#fff",
    borderRadius: 14,
    flexDirection: "row",
    marginBottom: 12,
    overflow: "hidden",
  },
  thumbnail: {
    height: 105,
    width: 110,
  },
  storyText: {
    flex: 1,
    padding: 12,
  },
  category: {
    color: "#b00020",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  storyTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  date: {
    color: "#888",
    fontSize: 12,
    marginTop: 8,
  },
  backToTopButton: {
    alignItems: "center",
    backgroundColor: "rgba(17, 17, 17, 0.92)",
    borderRadius: 999,
    bottom: 18,
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "absolute",
    right: 16,
  },
  backToTopText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 5,
  },
});