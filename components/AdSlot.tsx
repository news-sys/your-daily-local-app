import { StyleSheet, Text, View } from "react-native";

type AdSlotProps = {
  label?: string;
};

export default function AdSlot({ label = "Advertisement" }: AdSlotProps) {
  return (
    <View style={styles.ad}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.text}>Advertiser Placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ad: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#bbb",
    backgroundColor: "#f7f7f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    padding: 14,
  },
  label: {
    fontSize: 11,
    color: "#777",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  text: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444",
  },
});