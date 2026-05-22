export type AdPlacement =
  | "home-top"
  | "home-between-sections"
  | "article-top"
  | "article-after-2"
  | "article-after-5"
  | "article-bottom";

export type AdItem = {
  id: string;
  headline: string;
  body: string;
  image?: string;
  url?: string;
  phone?: string;
  callToAction?: string;
};

export type AdSlot = {
  placement: AdPlacement;
  label: string;
  rotationIntervalMs?: number;
  ads: AdItem[];
};

export const adSlots: AdSlot[] = [
  {
    placement: "home-top",
    label: "Advertisement",
    rotationIntervalMs: 6000,
    ads: [
      {
        id: "home-top-1",
        headline: "Your Daily Local Advertising",
        body: "Reach local readers across Warren and Forest counties.",
        url: "https://yourdailylocal.com/advertise",
        callToAction: "Advertise with us",
      },
      {
        id: "home-top-2",
        headline: "Community Partner",
        body: "Reach thousands of local readers",
        callToAction: "Learn more",
      },
    ],
  },
  {
    placement: "home-between-sections",
    label: "Advertisement",
    rotationIntervalMs: 7000,
    ads: [
      {
        id: "home-between-1",
        headline: "Local Advertising Partner",
        body: "Advertise with Your Daily Local",
        callToAction: "Get started",
      },
      {
        id: "home-between-2",
        headline: "Support Local Journalism",
        body: "Promote your business across Warren County",
        callToAction: "Sponsor a section",
      },
    ],
  },
  {
    placement: "article-top",
    label: "Sponsored",
    rotationIntervalMs: 6000,
    ads: [
      {
        id: "article-top-1",
        headline: "Sponsor Message",
        body: "Your Daily Local sponsor placement",
        callToAction: "Advertise here",
      },
      {
        id: "article-top-2",
        headline: "Community Sponsor",
        body: "Support local news coverage",
        callToAction: "Learn more",
      },
    ],
  },
  {
    placement: "article-after-2",
    label: "Sponsored",
    rotationIntervalMs: 7000,
    ads: [
      {
        id: "article-after-2-1",
        headline: "Local Advertising Partner",
        body: "Your business could be here",
        callToAction: "Contact us",
      },
      {
        id: "article-after-2-2",
        headline: "Regional Sponsor",
        body: "Reach local readers daily",
        callToAction: "Advertise today",
      },
    ],
  },
  {
    placement: "article-after-5",
    label: "Sponsored",
    rotationIntervalMs: 7000,
    ads: [
      {
        id: "article-after-5-1",
        headline: "Community Sponsor",
        body: "Support local journalism",
        callToAction: "Become a sponsor",
      },
      {
        id: "article-after-5-2",
        headline: "Business Spotlight",
        body: "Advertise with YDL",
        callToAction: "Reserve this spot",
      },
    ],
  },
  {
    placement: "article-bottom",
    label: "Sponsored",
    rotationIntervalMs: 8000,
    ads: [
      {
        id: "article-bottom-1",
        headline: "Your Daily Local Sponsor",
        body: "Advertise with Your Daily Local",
        callToAction: "Promote your business",
      },
      {
        id: "article-bottom-2",
        headline: "Local Business Partner",
        body: "Connect with local audiences",
        callToAction: "Learn more",
      },
    ],
  },
];

export function getAdSlotByPlacement(
  placement: AdPlacement
): AdSlot | undefined {
  return adSlots.find((slot) => slot.placement === placement);
}