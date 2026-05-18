import { DEV_CONFIG } from "../config/dev";

import {
    getMockBreakingStories,
    getMockNewsStories,
    getMockSportsStories,
    getMockStoryById,
    getMockTopStories,
} from "./providers/mockProvider";

import {
    getWordPressBreakingStories,
    getWordPressNewsStories,
    getWordPressSportsStories,
    getWordPressStoryById,
    getWordPressTopStories,
} from "./providers/wordpressProvider";

const provider = DEV_CONFIG.dataProvider;

export const getTopStories =
  provider === "wordpress"
    ? getWordPressTopStories
    : getMockTopStories;

export const getNewsStories =
  provider === "wordpress"
    ? getWordPressNewsStories
    : getMockNewsStories;

export const getSportsStories =
  provider === "wordpress"
    ? getWordPressSportsStories
    : getMockSportsStories;

export const getBreakingStories =
  provider === "wordpress"
    ? getWordPressBreakingStories
    : getMockBreakingStories;

export const getStoryById =
  provider === "wordpress"
    ? getWordPressStoryById
    : getMockStoryById;