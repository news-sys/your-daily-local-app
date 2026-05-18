import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Post } from "../types/Post";

type BreakingBannerProps = {
  story?: Post;
};

export default function BreakingBanner({
  story,
}: BreakingBannerProps) {
  if (!story) return null;

  return (
    <Pressable
      onPress={() => router.push(`/article?id=${story.id}`)}
    >
      <View style={styles.wrap}>
        <Text style={styles.label}>BREAKING NEWS</Text>

        <Text style={styles.title}>
          {story.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#b00020",
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  label: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
});