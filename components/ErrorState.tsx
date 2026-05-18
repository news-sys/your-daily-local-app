import { Pressable, StyleSheet, Text, View } from "react-native";

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export default function ErrorState({
  message = "Something went wrong while loading stories.",
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Unable to load stories</Text>

      <Text style={styles.message}>
        {message}
      </Text>

      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      ) : null}
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
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#111111",
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
});