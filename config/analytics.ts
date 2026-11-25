export const ANALYTICS_CONFIG = {
  endpoint: "https://yourdailylocal.com/wp-json/ydl-app/v1/analytics",
  apiKey: process.env.EXPO_PUBLIC_YDL_ANALYTICS_KEY ?? "",
  enabled: true,
};