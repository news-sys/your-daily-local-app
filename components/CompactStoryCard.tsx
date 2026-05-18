import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type CompactStoryCardProps = {
  id: number;
  title: string;
  excerpt?: string;
  image?: string;
  category?: string;
};

export default function CompactStoryCard({
  id,
  title,
  excerpt,
  image,
  category,
}: CompactStoryCardProps) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/article?id=${id}`)}
    >
      {image ? <Image source={{ uri: image }} style={styles.image} /> : null}

      <View style={styles.textWrap}>
        {category ? <Text style={styles.category}>{category}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {excerpt ? <Text style={styles.excerpt} numberOfLines={2}>{excerpt}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  image: {
    width: 112,
    height: 78,
    backgroundColor: "#ddd",
  },
  textWrap: {
    flex: 1,
  },
  category: {
    fontSize: 11,
    fontWeight: "900",
    color: "#b00020",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111",
    lineHeight: 20,
  },
  excerpt: {
    marginTop: 4,
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
  },
});