import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import RotatingAdSlot from "@/components/RotatingAdSlot";
import { getPostById } from "@/services/api";
import { isPostSaved, toggleSavedPost } from "@/services/savedPosts";
import type { Post } from "@/types/Post";

function formatArticleBody(body?: string): string[] {
  if (!body) return [];

  return body
    .split(/\n{1,}|\r\n{1,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function formatDisplayDate(date?: string): string {
  if (!date) return "";

  try {
    return new Date(date).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return date;
  }
}

export default function ArticleScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;

  const [post, setPost] = useState<Post | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const bodyParagraphs = useMemo(
    () => formatArticleBody(post?.body),
    [post?.body]
  );

  const loadPost = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await getPostById(id);

      setPost(result);

      if (result) {
        const saved = await isPostSaved(result.id);
        setIsSaved(saved);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const shareArticle = async () => {
    if (!post) return;

    try {
      await Share.share({
        title: post.title,
        message: `${post.title}\n\nShared from Your Daily Local`,
      });
    } catch {
      // Share canceled
    }
  };

  const handleToggleSaved = async () => {
    if (!post) return;

    const nextSavedState = await toggleSavedPost(post);
    setIsSaved(nextSavedState);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading story...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style="light" />

        <View style={styles.loadingContainer}>
          <Text style={styles.notFoundTitle}>Story not found</Text>
          <Text style={styles.centerText}>This story could not be loaded.</Text>

          <Pressable
            style={styles.backButtonLarge}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonLargeText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
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
              <Pressable onPress={shareArticle} style={styles.headerIconButton}>
                <Ionicons
                  name="share-social-outline"
                  size={22}
                  color="#fff"
                />
              </Pressable>

              <Pressable
                onPress={handleToggleSaved}
                style={styles.headerIconButton}
              >
                <Ionicons
                  name={isSaved ? "bookmark" : "bookmark-outline"}
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
      >
        {post.image ? (
          <View>
            <Image
              source={{ uri: post.image }}
              style={styles.heroImage}
              contentFit="cover"
              transition={250}
              cachePolicy="memory-disk"
            />

            {post.imageCaption ? (
              <Text style={styles.imageCaption}>{post.imageCaption}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.articleCard}>
          <View style={styles.metaRow}>
            {post.category ? (
              <Text style={styles.category}>{post.category}</Text>
            ) : null}

            {post.date ? (
              <Text style={styles.date}>{formatDisplayDate(post.date)}</Text>
            ) : null}
          </View>

          <Text style={styles.title}>{post.title}</Text>

          <View style={styles.divider} />

          <RotatingAdSlot placement="article-top" />

          {bodyParagraphs.length > 0 ? (
            <>
              {bodyParagraphs.map((paragraph, index) => {
                const isAfterSecondParagraph = index === 1;
                const isAfterFifthParagraph = index === 4;
                const isAfterLastParagraph =
                  index === bodyParagraphs.length - 1;

                return (
                  <View key={`${index}-${paragraph.slice(0, 20)}`}>
                    <Text style={styles.body}>{paragraph}</Text>

                    {isAfterSecondParagraph ? (
                      <RotatingAdSlot placement="article-after-2" />
                    ) : null}

                    {isAfterFifthParagraph ? (
                      <RotatingAdSlot placement="article-after-5" />
                    ) : null}

                    {isAfterLastParagraph ? (
                      <RotatingAdSlot placement="article-bottom" />
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={styles.body}>No article text available.</Text>
          )}

          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.actionButton,
                isSaved ? styles.savedButton : styles.unsavedButton,
              ]}
              onPress={handleToggleSaved}
            >
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={18}
                color="#fff"
              />

              <Text style={styles.actionButtonText}>
                {isSaved ? "Saved" : "Save"}
              </Text>
            </Pressable>

            <Pressable style={styles.shareButton} onPress={shareArticle}>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Share</Text>
            </Pressable>
          </View>
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
    marginTop: 0,
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
  divider: {
    backgroundColor: "#e4e4e4",
    height: 1,
    marginVertical: 22,
    width: "100%",
  },
  body: {
    color: "#222",
    fontSize: 18,
    lineHeight: 31,
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 10,
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