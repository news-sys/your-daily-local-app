import { DEV_CONFIG } from "../../config/dev";
import { mockPosts } from "../../data/mockPosts";
import type { Post } from "../../types/Post";

async function simulateNetworkBehavior() {
  if (DEV_CONFIG.simulateApiDelay) {
    await new Promise((resolve) => {
      setTimeout(resolve, DEV_CONFIG.apiDelayMs);
    });
  }

  if (DEV_CONFIG.simulateApiError) {
    throw new Error("Simulated API failure");
  }
}

export async function getMockTopStories(): Promise<Post[]> {
  await simulateNetworkBehavior();

  return mockPosts as Post[];
}

export async function getMockNewsStories(): Promise<Post[]> {
  await simulateNetworkBehavior();

  return mockPosts.filter((post) => post.category === "News") as Post[];
}

export async function getMockSportsStories(): Promise<Post[]> {
  await simulateNetworkBehavior();

  return mockPosts.filter((post) => post.category === "Sports") as Post[];
}

export async function getMockBreakingStories(): Promise<Post[]> {
  await simulateNetworkBehavior();

  const breakingWindowHours = 72;

  return mockPosts.filter((post) => {
    if (post.category !== "Breaking") return false;

    const postDate = new Date(post.date);
    const now = new Date();

    const hoursOld =
      (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);

    return hoursOld <= breakingWindowHours;
  }) as Post[];
}

export async function getMockStoryById(
  id: number
): Promise<Post | undefined> {
  await simulateNetworkBehavior();

  return mockPosts.find((post) => post.id === id) as Post | undefined;
}