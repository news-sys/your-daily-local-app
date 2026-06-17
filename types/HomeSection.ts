import type { Post } from "@/types/Post";

export type HomeSection = {
  id: string;
  title: string;
  slug: string;
  type: "lead" | "list" | "ad";
  category?: string;
  posts: Post[];
};