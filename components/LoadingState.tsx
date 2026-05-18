import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type LoadingStateProps = {
  message?: string;
};

export default function LoadingState({
  message = "Loading latest stories...",
}: LoadingStateProps) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: "#555",
    fontWeight: "600",
  },
});