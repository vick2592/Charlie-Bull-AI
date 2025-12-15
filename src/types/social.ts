/**
 * Social Media Integration Types
 */

export type Platform = 'bluesky' | 'x';

export type InteractionType = 'mention' | 'reply' | 'quote';

export interface SocialPost {
  id: string;
  platform: Platform;
  content: string;
  timestamp: Date;
  scheduledFor?: Date;
}

export interface SocialInteraction {
  id: string;
  platform: Platform;
  type: InteractionType;
  authorHandle: string;
  authorId: string;
  content: string;
  postId: string;
  timestamp: Date;
  processed: boolean;
}

export interface SocialReply {
  id: string;
  platform: Platform;
  replyToId: string;
  replyToHandle: string;
  content: string;
  timestamp: Date;
  sent: boolean;
}

export interface DailyQuota {
  date: string; // YYYY-MM-DD
  postsCount: number;
  repliesCount: number;
  postsLimit: number;
  repliesLimit: number;
}

export interface PostSchedule {
  morning: string; // HH:mm format (e.g., "08:00")
  afternoonEvening: string[]; // Alternating times ["17:00", "21:00"]
  queueProcessing: string; // "00:00" for midnight
}

export const DEFAULT_SCHEDULE: PostSchedule = {
  morning: '08:00',
  afternoonEvening: ['17:00', '21:00'], // Alternate daily
  queueProcessing: '00:00'
};

export const RATE_LIMITS = {
  dailyPosts: 2,
  dailyReplies: 3
} as const;
