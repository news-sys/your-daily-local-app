export type Post = {
  id: number;
  title: string;
  excerpt?: string;
  body: string;
  image?: string;
  imageCaption?: string;
  category: string;
  date: string;
};

export type PaginatedPosts = {
  posts: Post[];
  hasMore: boolean;
  nextPage: number | null;
};