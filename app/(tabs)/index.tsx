import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import RotatingAdSlot from "@/components/RotatingAdSlot";
import { trackEvent, trackScreenView } from "@/services/analytics";
import { getBreakingPosts, getHomepageSections } from "@/services/api";
import type { HomeSection } from "@/types/HomeSection";
import type { Post } from "@/types/Post";

const logo = require("@/assets/images/ydl-logo.png");

function shouldShowAdAfterSection(section: HomeSection): boolean {
  return section.id === "top-story" || section.id === "latest-news";
}

export default function HomeScreen() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [breakingPosts, setBreakingPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasTrackedScreenView = useRef(false);

  const loadHome = useCallback(async (refreshing = false) => {
    try {
      refreshing ? setIsRefreshing(true) : setIsLoading(true);
      setErrorMessage(null);

      const [homeSections, breaking] = await Promise.all([
        getHomepageSections(),
        getBreakingPosts(1),
      ]);

      setSections(homeSections);
      setBreakingPosts(breaking.posts);
    } catch {
      setErrorMessage("Unable to load home feed. Pull down to try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!hasTrackedScreenView.current) {
      trackScreenView("home");
      hasTrackedScreenView.current = true;
    }

    loadHome();
  }, [loadHome]);

  const openBreakingFeed = useCallback(() => {
    trackEvent("screen_view", {
      screenName: "home_breaking_bar_tap",
      destination: "breaking",
    });

    router.push("/breaking");
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading Your Daily Local...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadHome(true)}
          />
        }
      >
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />

          <Text style={styles.tagline}>
            The news you need, when you need it
          </Text>
        </View>

        <RotatingAdSlot placement="home-top" />

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {breakingPosts.length > 0 &&
        breakingPosts[0]?.category === "Breaking" ? (
          <Pressable style={styles.breakingBar} onPress={openBreakingFeed}>
            <Text style={styles.breakingLabel}>Breaking</Text>

            <Text style={styles.breakingText} numberOfLines={1}>
              {breakingPosts[0].title}
            </Text>
          </Pressable>
        ) : null}

        {sections.map((section) => (
          <View key={section.id}>
            {section.type === "ad" ? null : section.type === "lead" ? (
              <LeadSection section={section} />
            ) : (
              <ListSection section={section} />
            )}

            {shouldShowAdAfterSection(section) ? (
              <RotatingAdSlot placement="home-between-sections" />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LeadSection({ section }: { section: HomeSection }) {
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
      params: { id: String(leadStory.id) },
    });
  }, [leadStory, section.id, section.title]);

  if (!leadStory) return null;

  return (
    <>
      <Text style={styles.mainSectionTitle}>{section.title}</Text>

      <Pressable style={styles.leadCard} onPress={openLeadStory}>
        {leadStory.image ? (
          <Image source={{ uri: leadStory.image }} style={styles.leadImage} />
        ) : null}

        <View style={styles.leadBody}>
          <Text style={styles.leadTitle}>{leadStory.title}</Text>

          {leadStory.excerpt ? (
            <Text style={styles.excerpt}>{leadStory.excerpt}</Text>
          ) : null}
        </View>
      </Pressable>
    </>
  );
}

function ListSection({ section }: { section: HomeSection }) {
  const openSection = useCallback(() => {
    trackEvent("screen_view", {
      screenName: "home_view_all_tap",
      sectionId: section.id,
      sectionTitle: section.title,
      destination: section.slug,
    });

    router.push({
      pathname: "/(tabs)/category/[slug]",
      params: { slug: section.slug },
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
        params: { id: String(post.id) },
      });
    },
    [section.id, section.title]
  );

  if (section.posts.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{section.title}</Text>

        <Pressable onPress={openSection}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>

      {section.posts.map((post) => (
        <Pressable
          key={String(post.id)}
          style={styles.storyRow}
          onPress={() => openStory(post)}
        >
          {post.image ? (
            <Image source={{ uri: post.image }} style={styles.thumbnail} />
          ) : null}

          <View style={styles.storyText}>
            {post.category ? (
              <Text style={styles.category}>{post.category}</Text>
            ) : null}

            <Text style={styles.storyTitle}>{post.title}</Text>

            {post.date ? <Text style={styles.date}>{post.date}</Text> : null}
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
});