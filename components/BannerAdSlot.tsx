import { StyleSheet, Text, View } from "react-native";

type BannerAdSlotProps = {
  label?: string;
  height?: number;
};

export default function BannerAdSlot({
  label = "Advertisement",
  height = 90,
}: BannerAdSlotProps) {
  return (
    <View style={[styles.wrap, { height }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.text}>Banner Ad Space</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#d0d0d0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    color: "#777",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  text: {
    fontSize: 14,
    fontWeight: "800",
    color: "#444",
  },
});