import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import {
    Linking,
    Pressable,
    StyleSheet,
    Text
} from "react-native";

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

  const handlePress = async () => {
    const target = activeAd.url ?? activeAd.phone;

    if (!target) return;

    const link = activeAd.phone ? `tel:${activeAd.phone}` : target;

    const canOpen = await Linking.canOpenURL(link);

    if (canOpen) {
      await Linking.openURL(link);
    }
  };

  return (
    <Pressable
      style={styles.adBox}
      onPress={handlePress}
      disabled={!activeAd.url && !activeAd.phone}
    >
      <Text style={styles.adLabel}>{slot.label}</Text>

      {activeAd.image ? (
        <Image
          source={{ uri: activeAd.image }}
          style={styles.adImage}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
        />
      ) : null}

      <Text style={styles.adHeadline}>{activeAd.headline}</Text>

      <Text style={styles.adBody}>{activeAd.body}</Text>

      {activeAd.callToAction ? (
        <Text style={styles.callToAction}>{activeAd.callToAction}</Text>
      ) : null}
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
    overflow: "hidden",
    padding: 18,
  },
  adLabel: {
    color: "#777",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  adImage: {
    backgroundColor: "#ddd",
    borderRadius: 10,
    height: 140,
    marginBottom: 12,
    width: "100%",
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
  callToAction: {
    color: "#b00020",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 10,
    textTransform: "uppercase",
  },
});