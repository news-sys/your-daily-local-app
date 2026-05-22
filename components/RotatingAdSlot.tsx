import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import {
    getAdSlotByPlacement,
    type AdPlacement,
} from "@/data/adSlots";

type RotatingAdSlotProps = {
  placement: AdPlacement;
};

export default function RotatingAdSlot({ placement }: RotatingAdSlotProps) {
  const slot = getAdSlotByPlacement(placement);
  const [activeIndex, setActiveIndex] = useState(0);

  const ads = useMemo(() => slot?.ads ?? [], [slot?.ads]);

  useEffect(() => {
    if (!slot || ads.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % ads.length);
    }, slot.rotationIntervalMs ?? 7000);

    return () => clearInterval(interval);
  }, [ads.length, slot]);

  if (!slot || ads.length === 0) {
    return null;
  }

  const activeAd = ads[activeIndex];

  return (
    <Pressable style={styles.adBox}>
      <Text style={styles.adLabel}>{slot.label}</Text>
      <Text style={styles.adHeadline}>{activeAd.headline}</Text>
      <Text style={styles.adBody}>{activeAd.body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  adBox: {
    alignItems: "center",
    backgroundColor: "#eeeeee",
    borderColor: "#d0d0d0",
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    marginBottom: 18,
    marginTop: 2,
    padding: 18,
  },
  adLabel: {
    color: "#777",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  adHeadline: {
    color: "#333",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  adBody: {
    color: "#666",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },
});