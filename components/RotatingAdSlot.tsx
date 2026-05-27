import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
    getAdSlotByPlacement,
    type AdPlacement,
    type LocalAdImageKey,
} from "@/data/adSlots";

const localAdImages: Partial<Record<LocalAdImageKey, number>> = {
  "sample-ad": require("../assets/images/ads/sample-banner.jpg"),
};

type RotatingAdSlotProps = {
  placement: AdPlacement;
};

export default function RotatingAdSlot({ placement }: RotatingAdSlotProps) {
  const slot = getAdSlotByPlacement(placement);
  const [activeIndex, setActiveIndex] = useState(0);

  const hasLoggedInitialView = useRef(false);

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

  const imageSource = activeAd.imageKey
    ? localAdImages[activeAd.imageKey]
    : undefined;

  useEffect(() => {
    if (!activeAd) return;

    if (!hasLoggedInitialView.current) {
      hasLoggedInitialView.current = true;
    }

    console.log("Ad impression", {
      placement,
      adId: activeAd.id,
      imageKey: activeAd.imageKey,
      viewedAt: new Date().toISOString(),
    });
  }, [activeAd, placement]);

  const handlePress = async () => {
    console.log("Ad clicked", {
      placement,
      adId: activeAd.id,
      imageKey: activeAd.imageKey,
      target: activeAd.url ?? activeAd.phone ?? null,
      clickedAt: new Date().toISOString(),
    });

    const target = activeAd.url ?? activeAd.phone;

    if (!target) return;

    const link = activeAd.phone ? `tel:${activeAd.phone}` : target;

    const canOpen = await Linking.canOpenURL(link);

    if (canOpen) {
      await Linking.openURL(link);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.adBox}
        onPress={handlePress}
        disabled={!activeAd.url && !activeAd.phone}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.adImage}
            contentFit="contain"
            transition={250}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Ad Space Available</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 18,
    marginTop: 2,
    width: "100%",
  },
  adBox: {
    backgroundColor: "transparent",
    width: "100%",
  },
  adImage: {
    aspectRatio: 900 / 650,
    backgroundColor: "transparent",
    width: "100%",
  },
  placeholder: {
    alignItems: "center",
    aspectRatio: 900 / 650,
    backgroundColor: "#f1f1f1",
    borderColor: "#d0d0d0",
    borderWidth: 1,
    justifyContent: "center",
    width: "100%",
  },
  placeholderText: {
    color: "#777",
    fontSize: 13,
    fontWeight: "800",
  },
});