export type LiveStream = {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  status: "live" | "upcoming" | "replay";
  publishedAt: string;
};

export const liveStreams: LiveStream[] = [
  {
    id: "ydl-channel",
    title: "Your Daily Local Video Center",
    description:
      "Watch Morning Pick-Up episodes, live broadcasts, government meetings, and community events.",
    youtubeUrl: "https://www.youtube.com/@yourdailylocal6027/streams",
    status: "upcoming",
    publishedAt: new Date().toISOString(),
  },
];