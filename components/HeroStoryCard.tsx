import { router } from "expo-router";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

type HeroStoryCardProps = {
  id: number;
  title: string;
  image?: string;
  category?: string;
};

export default function HeroStoryCard({
  id,
  title,
  image,
  category,
}: HeroStoryCardProps) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/article?id=${id}`)}
    >
      <ImageBackground
        source={{ uri: image }}
        style={styles.image}
        imageStyle={styles.imageStyle}
      >
        <View style={styles.overlay}>
          {category ? (
            <Text style={styles.category}>{category}</Text>
          ) : null}

          <Text style={styles.title}>{title}</Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  image: {
    height: 260,
    justifyContent: "flex-end",
  },
  imageStyle: {
    borderRadius: 0,
  },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 16,
  },
  category: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
});