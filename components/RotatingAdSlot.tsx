import { useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { AdPlacement } from "@/data/adSlots";
import {
  buildWeightedRotation,
  getAds,
  getAdsForRotation,
  recordAdClick,
  recordAdImpression,
  type WordPressAd,
} from "@/services/ads";
import { trackAdImpression } from "@/services/analytics";

type RotatingAdSlotProps = {
  placement?: AdPlacement;
  rotationSlug?: string;
  trackingPlacement?: string;
  rotationIntervalMs?: number;
  sponsorLabel?: string;
};

type RotationState = {
  sourceKey: string;
  signature: string;
  ads: WordPressAd[];
  index: number;
};

// Recheck the shared cache without forcing a network request.
// services/ads.ts controls its five-minute freshness policy.
const CACHE_CHECK_INTERVAL_MS = 15000;
const DEFAULT_ROTATION_INTERVAL_MS = 7000;

function safeInterval(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1000, value)
    : DEFAULT_ROTATION_INTERVAL_MS;
}

export default function RotatingAdSlot({
  placement,
  rotationSlug,
  trackingPlacement,
  rotationIntervalMs,
  sponsorLabel,
}: RotatingAdSlotProps) {
  const isFocused = useIsFocused();

  const [appActive, setAppActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );

  const active = isFocused && appActive;

  const sourceKey = rotationSlug
    ? `rotation:${rotationSlug}`
    : placement
      ? `placement:${placement}`
      : "";

  const trackingKey =
    trackingPlacement ??
    placement ??
    rotationSlug ??
    "unknown-ad-placement";

  const [rotation, setRotation] = useState<RotationState>({
    sourceKey: "",
    signature: "",
    ads: [],
    index: 0,
  });

  const impressionKeyRef = useRef<string | null>(null);

  const currentAd =
    rotation.sourceKey === sourceKey
      ? rotation.ads[rotation.index]
      : undefined;

  const effectiveIntervalMs = safeInterval(
    rotationIntervalMs ?? currentAd?.rotationIntervalMs
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (state) => {
        setAppActive(state === "active");
      }
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active || !sourceKey) return;

    let cancelled = false;
    let loading = false;

    async function refresh(): Promise<void> {
      if (loading || cancelled) return;

      loading = true;

      try {
        const result = rotationSlug
          ? await getAdsForRotation(
              rotationSlug,
              safeInterval(rotationIntervalMs)
            )
          : placement
            ? await getAds(placement)
            : [];

        if (cancelled) return;

        // Compare the underlying list, not its randomized order.
        // Unchanged checks must not restart the displayed ad.
        const signature = JSON.stringify(result);
        const ordered = buildWeightedRotation(result);

        setRotation((previous) => {
          if (
            previous.sourceKey === sourceKey &&
            previous.signature === signature
          ) {
            return previous;
          }

          const previousAdId =
            previous.sourceKey === sourceKey
              ? previous.ads[previous.index]?.id
              : undefined;

          const retainedIndex = ordered.findIndex(
            (ad) => ad.id === previousAdId
          );

          return {
            sourceKey,
            signature,
            ads: ordered,
            index: retainedIndex >= 0 ? retainedIndex : 0,
          };
        });
      } catch (error) {
        // Keep displayed ads during temporary request failures.
        // Successful empty responses still clear the rotation.
        if (!cancelled) {
          console.warn(
            "[RotatingAdSlot] Unable to refresh ads:",
            error
          );
        }
      } finally {
        loading = false;
      }
    }

    void refresh();

    const timer = setInterval(
      () => void refresh(),
      CACHE_CHECK_INTERVAL_MS
    );

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    active,
    sourceKey,
    placement,
    rotationSlug,
    rotationIntervalMs,
  ]);

  useEffect(() => {
    if (
      !active ||
      rotation.sourceKey !== sourceKey ||
      rotation.ads.length <= 1
    ) {
      return;
    }

    const timer = setInterval(() => {
      setRotation((previous) => {
        if (
          previous.sourceKey !== sourceKey ||
          previous.ads.length <= 1
        ) {
          return previous;
        }

        return {
          ...previous,
          index: (previous.index + 1) % previous.ads.length,
        };
      });
    }, effectiveIntervalMs);

    return () => clearInterval(timer);
  }, [
    active,
    sourceKey,
    rotation.sourceKey,
    rotation.ads,
    effectiveIntervalMs,
  ]);

  useEffect(() => {
    if (!active || !currentAd) return;

    const key = JSON.stringify([
      sourceKey,
      trackingKey,
      currentAd.id,
    ]);

    if (impressionKeyRef.current === key) return;

    impressionKeyRef.current = key;

    void recordAdImpression(currentAd.id, trackingKey);

    trackAdImpression(
      trackingKey,
      currentAd.sponsorName ?? undefined
    );
  }, [active, currentAd, sourceKey, trackingKey]);

  const handlePress = useCallback(async () => {
    if (!currentAd) return;

    void recordAdClick(currentAd.id, trackingKey);

    if (currentAd.destinationUrl) {
      try {
        await Linking.openURL(currentAd.destinationUrl);
        return;
      } catch {
        // Fall through to the phone number when available.
      }
    }

    if (currentAd.phoneNumber) {
      try {
        await Linking.openURL(`tel:${currentAd.phoneNumber}`);
      } catch {
        // Linking failures must not interrupt the screen.
      }
    }
  }, [currentAd, trackingKey]);

  const presentingSponsorText = useMemo(() => {
    if (placement !== "presenting-home") return null;

    const label =
      sponsorLabel?.trim() ||
      currentAd?.sponsorName?.trim();

    return label ? `YDL App powered by ${label}` : null;
  }, [placement, sponsorLabel, currentAd?.sponsorName]);

  if (!currentAd) return null;

  return (
    <View style={styles.container}>
      {presentingSponsorText ? (
        <Text style={styles.presentingText}>
          {presentingSponsorText}
        </Text>
      ) : null}

      <Pressable
        onPress={handlePress}
        disabled={
          !currentAd.destinationUrl &&
          !currentAd.phoneNumber
        }
        style={styles.pressable}
      >
        <Image
          source={{ uri: currentAd.imageUrl }}
          style={styles.image}
          contentFit="contain"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={currentAd.id}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    width: "100%",
  },

  presentingText: {
    color: "#555",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },

  pressable: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },

  image: {
    aspectRatio: 900 / 650,
    width: "100%",
  },
});