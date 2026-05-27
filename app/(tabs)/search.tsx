import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { searchPosts } from "@/services/api";
import type { Post } from "@/types/Post";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Post[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setIsLoading(true);
      setHasSearched(true);

      const response = await searchPosts(trimmedQuery);
      setResults(response.posts);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      <View style={styles.container}>
        <Text style={styles.title}>Search Stories</Text>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search news, sports, breaking..."
            placeholderTextColor="#777"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />

          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#fff" />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" />
            <Text style={styles.emptyText}>Searching stories...</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={
              results.length === 0
                ? styles.emptyContainer
                : styles.resultsContainer
            }
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Ionicons name="search-outline" size={42} color="#999" />

                <Text style={styles.emptyText}>
                  {hasSearched
                    ? "No stories matched your search."
                    : "Search for local news, sports, and breaking stories."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.resultCard}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/article",
                    params: { id: String(item.id) },
                  })
                }
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.resultImage}
                    contentFit="cover"
                    transition={250}
                    cachePolicy="memory-disk"
                  />
                ) : null}

                <View style={styles.resultBody}>
                  <Text style={styles.category}>{item.category}</Text>
                  <Text style={styles.resultTitle}>{item.title}</Text>

                  {item.excerpt ? (
                    <Text style={styles.excerpt}>{item.excerpt}</Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
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
    padding: 16,
  },
  title: {
    color: "#111",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 18,
    marginTop: 12,
  },
  searchRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#ddd",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  searchButton: {
    alignItems: "center",
    backgroundColor: "#b00020",
    borderRadius: 14,
    justifyContent: "center",
    marginLeft: 10,
    paddingHorizontal: 18,
  },
  resultsContainer: {
    paddingBottom: 24,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
  },
  resultImage: {
    backgroundColor: "#ddd",
    height: 170,
    width: "100%",
  },
  resultBody: {
    padding: 15,
  },
  category: {
    color: "#b00020",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  resultTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
  },
  excerpt: {
    color: "#555",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyText: {
    color: "#666",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 270,
    textAlign: "center",
  },
});