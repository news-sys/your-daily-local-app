import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type SectionHeaderProps = {
  title: string;
  href?: string;
  actionText?: string;
};

export default function SectionHeader({
  title,
  href,
  actionText,
}: SectionHeaderProps) {
  function handlePress() {
    if (href) {
      router.push(href as any);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.line} />

      <View style={styles.row}>
        <View style={styles.spacer} />

        <Text style={styles.title}>{title}</Text>

        <View style={styles.actionWrap}>
          {href && actionText ? (
            <Pressable onPress={handlePress}>
              <Text style={styles.action}>{actionText}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    marginBottom: 12,
  },
  line: {
    height: 5,
    backgroundColor: "#18344a",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    width: 90,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#111",
    textTransform: "uppercase",
  },
  actionWrap: {
    width: 90,
    alignItems: "flex-end",
  },
  action: {
    fontSize: 12,
    color: "#b00020",
    fontWeight: "700",
  },
});