export type AdPlacement =
  | "home-top"
  | "home-between-sections"
  | "article-top"
  | "article-after-2"
  | "article-after-5"
  | "article-bottom";

export type LocalAdImageKey =
  | "sample-ad"
  | "sponsor-1"
  | "sponsor-2"
  | "sponsor-3"
  | "sponsor-4"
  | "sponsor-5";

export type AdItem = {
  id: string;
  imageKey?: LocalAdImageKey;
  url?: string;
  phone?: string;
};

export type AdSlot = {
  placement: AdPlacement;
  rotationIntervalMs?: number;
  ads: AdItem[];
};

export const adSlots: AdSlot[] = [
  {
    placement: "home-top",
    rotationIntervalMs: 6000,
    ads: [
      {
        id: "home-top-1",
        imageKey: "sample-ad",
        
      },
      {
        id: "home-top-2",
        imageKey: "sponsor-1",
      },
    ],
  },
  {
    placement: "home-between-sections",
    rotationIntervalMs: 7000,
    ads: [
      {
        id: "home-between-1",
        imageKey: "sample-ad",
        
      },
      {
        id: "home-between-2",
        imageKey: "sponsor-2",
      },
    ],
  },
  {
    placement: "article-top",
    rotationIntervalMs: 6000,
    ads: [
      {
        id: "article-top-1",
        imageKey: "sample-ad",
        
      },
      {
        id: "article-top-2",
        imageKey: "sponsor-3",
      },
    ],
  },
  {
    placement: "article-after-2",
    rotationIntervalMs: 7000,
    ads: [
      {
        id: "article-after-2-1",
        imageKey: "sample-ad",
        
      },
      {
        id: "article-after-2-2",
        imageKey: "sponsor-4",
      },
    ],
  },
  {
    placement: "article-after-5",
    rotationIntervalMs: 7000,
    ads: [
      {
        id: "article-after-5-1",
        imageKey: "sample-ad",
        
      },
      {
        id: "article-after-5-2",
        imageKey: "sponsor-5",
      },
    ],
  },
  {
    placement: "article-bottom",
    rotationIntervalMs: 8000,
    ads: [
      {
        id: "article-bottom-1",
        imageKey: "sample-ad",
        
      },
      {
        id: "article-bottom-2",
        imageKey: "sponsor-1",
      },
    ],
  },
];

export function getAdSlotByPlacement(
  placement: AdPlacement
): AdSlot | undefined {
  return adSlots.find((slot) => slot.placement === placement);
}