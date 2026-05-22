import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
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

import { getPostById } from "@/services/api";
import { isPostSaved, toggleSavedPost } from "@/services/savedPosts";
import type { Post } from "@/types/Post";

export default function ArticleScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;

  const [post, setPost] = useState<Post | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const loadPost = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const result = await getPostById(id);
    setPost(result);

    if (result) {
      const saved = await isPostSaved(result.id);
      setIsSaved(saved);
    }

    setIsLoading(false);
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
      // User may cancel native share.
    }
  };

  const handleToggleSaved = async () => {
    if (!post) return;

    const nextSavedState = await toggleSavedPost(post);
    setIsSaved(nextSavedState);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <Stack.Screen options={{ title: "Loading..." }} />

        <View style={styles.centerState}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading story...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <Stack.Screen options={{ title: "Story Not Found" }} />

        <View style={styles.centerState}>
          <Text style={styles.notFoundTitle}>Story not found</Text>
          <Text style={styles.centerText}>This story could not be loaded.</Text>

          <Pressable style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonLargeText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <StatusBar style="dark" />

      <Stack.Screen
        options={{
          title: post.category || "Story",
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={shareArticle} style={styles.headerIconButton}>
                <Ionicons name="share-social-outline" size={22} color="#b00020" />
              </Pressable>

              <Pressable onPress={handleToggleSaved} style={styles.headerIconButton}>
                <Ionicons
                  name={isSaved ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color="#b00020"
                />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {post.image ? (
          <Image
            source={{ uri: post.image }}
            style={styles.heroImage}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
          />
        ) : null}

        <View style={styles.articleCard}>
          {post.category ? <Text style={styles.category}>{post.category}</Text> : null}

          <Text style={styles.title}>{post.title}</Text>

          {post.date ? <Text style={styles.date}>{post.date}</Text> : null}

          <View style={styles.divider} />

          {post.body ? (
            <Text style={styles.body}>{post.body}</Text>
          ) : (
            <Text style={styles.body}>No article text available.</Text>
          )}

          <Pressable
            style={[
              styles.saveButton,
              isSaved ? styles.savedButton : styles.unsavedButton,
            ]}
            onPress={handleToggleSaved}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={19}
              color="#fff"
            />
            <Text style={styles.saveButtonText}>
              {isSaved ? "Saved Story" : "Save Story"}
            </Text>
          </Pressable>

          <Pressable style={styles.shareButton} onPress={shareArticle}>
            <Ionicons name="share-social-outline" size={19} color="#fff" />
            <Text style={styles.shareButtonText}>Share Story</Text>
          </Pressable>
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
  container: {
    backgroundColor: "#f6f6f6",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flex: 1,
  },
  content: {
    paddingBottom: 36,
  },
  centerState: {
    alignItems: "center",
    backgroundColor: "#f6f6f6",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    color: "#666",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    textAlign: "center",
  },
  notFoundTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
  },
  backButtonLarge: {
    backgroundColor: "#b00020",
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 18,
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
  },
  headerIconButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  heroImage: {
    backgroundColor: "#ddd",
    height: 260,
    width: "100%",
  },
  articleCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -18,
    padding: 18,
  },
  category: {
    color: "#b00020",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: "#111",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  date: {
    color: "#777",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
  },
  divider: {
    backgroundColor: "#e5e5e5",
    height: 1,
    marginVertical: 18,
  },
  body: {
    color: "#222",
    fontSize: 17,
    lineHeight: 27,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
    padding: 14,
  },
  unsavedButton: {
    backgroundColor: "#111",
  },
  savedButton: {
    backgroundColor: "#b00020",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 8,
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: "#b00020",
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
    padding: 14,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 8,
  },
});