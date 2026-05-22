import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Post } from "@/types/Post";

const SAVED_POSTS_KEY = "ydl_saved_posts";

export async function getSavedPosts(): Promise<Post[]> {
  const raw = await AsyncStorage.getItem(SAVED_POSTS_KEY);

  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function isPostSaved(id: number): Promise<boolean> {
  const savedPosts = await getSavedPosts();

  return savedPosts.some((post) => post.id === id);
}

export async function savePost(post: Post): Promise<void> {
  const savedPosts = await getSavedPosts();

  const alreadySaved = savedPosts.some((item) => item.id === post.id);

  if (alreadySaved) return;

  await AsyncStorage.setItem(
    SAVED_POSTS_KEY,
    JSON.stringify([post, ...savedPosts])
  );
}

export async function removeSavedPost(id: number): Promise<void> {
  const savedPosts = await getSavedPosts();

  const updatedPosts = savedPosts.filter((post) => post.id !== id);

  await AsyncStorage.setItem(SAVED_POSTS_KEY, JSON.stringify(updatedPosts));
}

export async function toggleSavedPost(post: Post): Promise<boolean> {
  const saved = await isPostSaved(post.id);

  if (saved) {
    await removeSavedPost(post.id);
    return false;
  }

  await savePost(post);
  return true;
}