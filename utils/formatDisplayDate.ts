export function formatDisplayDate(date?: string): string {
  if (!date) return "";

  const normalizedDate = date.includes("T") ? date : date.replace(" ", "T");
  const storyDate = new Date(normalizedDate);

  if (Number.isNaN(storyDate.getTime())) {
    return date;
  }

  const now = new Date();
  const diffMs = now.getTime() - storyDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  const formatTime = (value: Date) =>
    value
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
      .replace(" AM", " a.m.")
      .replace(" PM", " p.m.");

  const isToday = now.toDateString() === storyDate.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday = yesterday.toDateString() === storyDate.toDateString();

  if (diffMinutes >= 0 && diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes >= 1 && diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  if (isToday) {
    return `Today • ${formatTime(storyDate)}`;
  }

  if (isYesterday) {
    return `Yesterday • ${formatTime(storyDate)}`;
  }

  return `${storyDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })} • ${formatTime(storyDate)}`;
}