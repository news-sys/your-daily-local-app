import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type StoryCardProps = {
  id: number;
  title: string;
  excerpt?: string;
  image?: string;
  category?: string;
};

export default function StoryCard({
  id,
  title,
  excerpt,
  image,
  category,
}: StoryCardProps) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/article?id=${id}`)}
    >
      {image ? <Image source={{ uri: image }} style={styles.image} /> : null}

      <View style={styles.content}>
        {category ? <Text style={styles.category}>{category}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {excerpt ? <Text style={styles.excerpt}>{excerpt}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  image: {
    width: "100%",
    height: 190,
    backgroundColor: "#ddd",
  },
  content: {
    padding: 14,
  },
  category: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b00020",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    lineHeight: 23,
  },
  excerpt: {
    marginTop: 8,
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
});