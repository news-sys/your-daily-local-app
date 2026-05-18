import { StyleSheet, Text, View } from "react-native";

type EmptyStateProps = {
  title: string;
  message: string;
};

export default function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: "#666666",
    lineHeight: 20,
  },
});