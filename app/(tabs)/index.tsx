import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import AdSlot from "../../components/AdSlot";
import BannerAdSlot from "../../components/BannerAdSlot";
import BrandHeader from "../../components/BrandHeader";
import BreakingBanner from "../../components/BreakingBanner";
import CompactStoryCard from "../../components/CompactStoryCard";
import HeroStoryCard from "../../components/HeroStoryCard";
import NewsletterBox from "../../components/NewsletterBox";
import SectionHeader from "../../components/SectionHeader";
import {
  getBreakingStories,
  getNewsStories,
  getSportsStories,
} from "../../services/api";
import type { Post } from "../../types/Post";

export default function HomeScreen() {
  const [breakingStories, setBreakingStories] = useState<Post[]>([]);
  const [newsStories, setNewsStories] = useState<Post[]>([]);
  const [sportsStories, setSportsStories] = useState<Post[]>([]);

  useEffect(() => {
    async function loadHomeData() {
      const breaking = await getBreakingStories();
      const news = await getNewsStories();
      const sports = await getSportsStories();

      setBreakingStories(breaking);
      setNewsStories(news);
      setSportsStories(sports);
    }

    loadHomeData();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BrandHeader />

      <BannerAdSlot label="Top Sponsor" height={90} />
      <BannerAdSlot label="Featured Advertiser" height={90} />

      <BreakingBanner story={breakingStories[0]} />

      <SectionHeader title="News" actionText="More News" href="/news" />

      {newsStories[0] ? (
        <HeroStoryCard
          id={newsStories[0].id}
          title={newsStories[0].title}
          image={newsStories[0].image}
          category={newsStories[0].category}
        />
      ) : null}

      {newsStories.slice(1, 6).map((post, index) => (
        <View key={post.id}>
          <CompactStoryCard
            id={post.id}
            title={post.title}
            excerpt={post.excerpt}
            image={post.image}
            category={post.category}
          />

          {index === 1 ? (
            <AdSlot label="Support Your Daily Local" />
          ) : null}
        </View>
      ))}

      <SectionHeader title="Sports" actionText="More Sports" href="/sports" />

      {sportsStories[0] ? (
        <HeroStoryCard
          id={sportsStories[0].id}
          title={sportsStories[0].title}
          image={sportsStories[0].image}
          category={sportsStories[0].category}
        />
      ) : null}

      {sportsStories.slice(1, 6).map((post, index) => (
        <View key={post.id}>
          <CompactStoryCard
            id={post.id}
            title={post.title}
            excerpt={post.excerpt}
            image={post.image}
            category={post.category}
          />

          {index === 1 ? (
            <AdSlot label="Sports Sponsor" />
          ) : null}
        </View>
      ))}

      <SectionHeader title="Subscribe To Our Newsletter" />

      <NewsletterBox />

      <SectionHeader title="Watch" />

      <View style={styles.videoBox}>
        <Text style={styles.videoTitle}>Your Daily Local Video</Text>

        <Text style={styles.videoText}>
          YouTube and livestream embeds will be added in a later build.
        </Text>
      </View>

      <AdSlot label="Bottom Sponsor" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    padding: 12,
    paddingBottom: 36,
  },
  videoBox: {
    backgroundColor: "#111111",
    padding: 18,
    marginBottom: 18,
  },
  videoTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  videoText: {
    color: "#dddddd",
    fontSize: 14,
    lineHeight: 20,
  },
});