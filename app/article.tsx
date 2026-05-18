import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import BrandHeader from "../components/BrandHeader";
import LoadingState from "../components/LoadingState";
import { getStoryById } from "../services/api";

export default function ArticleScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<any | null>(null);

  useEffect(() => {
    async function loadStory() {
      const storyId = Number(id);
      const foundStory = await getStoryById(storyId);

      setStory(foundStory ?? null);
      setLoading(false);
    }

    loadStory();
  }, [id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BrandHeader />

      {loading ? (
        <LoadingState message="Loading story..." />
      ) : story ? (
        <>
          {story.image ? (
            <Image source={{ uri: story.image }} style={styles.image} />
          ) : null}

          <Text style={styles.category}>{story.category}</Text>
          <Text style={styles.title}>{story.title}</Text>

          {story.date ? <Text style={styles.date}>{story.date}</Text> : null}

          <Text style={styles.body}>{story.body}</Text>
        </>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Story not found.</Text>
          <Text style={styles.emptyText}>
            This story may no longer be available.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  image: {
    width: "100%",
    height: 240,
    backgroundColor: "#dddddd",
    marginBottom: 16,
  },
  category: {
    fontSize: 12,
    fontWeight: "900",
    color: "#b00020",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111111",
    lineHeight: 34,
    marginBottom: 10,
  },
  date: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 18,
  },
  body: {
    fontSize: 17,
    color: "#222222",
    lineHeight: 26,
  },
  emptyBox: {
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#666666",
    lineHeight: 20,
  },
});