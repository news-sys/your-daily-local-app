export type Post = {
  id: number;
  title: string;
  excerpt?: string;
  body: string;
  bodyHtml?: string;
  image?: string;
  imageCaption?: string;
  category: string;
  date: string;
  modified?: string;
  author?: string;
  link?: string;
};

export type PaginatedPosts = {
  posts: Post[];
  hasMore: boolean;
  nextPage: number | null;
};

export type ContentRequestOptions = {
  forceRefresh?: boolean;
};