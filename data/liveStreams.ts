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
    id: "morning-pick-up",
    title: "Morning Pick-Up",
    description:
      "Your Daily Local's morning news show with the stories you need to start the day.",
    youtubeUrl: "https://www.youtube.com/@YourDailyLocal/live",
    status: "upcoming",
    publishedAt: new Date().toISOString(),
  },
];