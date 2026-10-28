// Enum values mirror the Prisma enums in apps/api/prisma/schema.prisma.
// Keep both in sync when adding a value.

export const Role = { CUSTOMER: 'CUSTOMER', STAFF: 'STAFF', ADMIN: 'ADMIN' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const MATERIALS = ['PLASTIC', 'WOODEN', 'FABRIC_PLUSH', 'METAL', 'SILICONE_RUBBER', 'MIXED', 'OTHER'] as const;
export type Material = (typeof MATERIALS)[number];

export const POWER_TYPES = ['ELECTRIC', 'NON_ELECTRIC'] as const;
export type PowerType = (typeof POWER_TYPES)[number];

export const PIECE_TYPES = ['SINGLE', 'MULTI'] as const;
export type PieceType = (typeof PIECE_TYPES)[number];

export const SIZE_CLASSES = ['STANDARD', 'LARGE'] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

/** What a parent can tell us their kid likes at signup. Toys carry the same tags. */
export const INTERESTS = [
  'ELECTRIC',
  'EDUCATIONAL_STEM',
  'WOODEN',
  'SOFT_PLUSH',
  'PRETEND_PLAY',
  'PUZZLES',
  'BUILDING_BLOCKS',
  'OUTDOOR_RIDE_ON',
  'MUSICAL',
  'ARTS_CRAFTS',
] as const;
export type Interest = (typeof INTERESTS)[number];

export const INTEREST_LABELS: Record<Interest, string> = {
  ELECTRIC: 'Electric / battery',
  EDUCATIONAL_STEM: 'Educational & STEM',
  WOODEN: 'Wooden',
  SOFT_PLUSH: 'Soft plush',
  PRETEND_PLAY: 'Pretend play',
  PUZZLES: 'Puzzles',
  BUILDING_BLOCKS: 'Building blocks',
  OUTDOOR_RIDE_ON: 'Outdoor & ride-on',
  MUSICAL: 'Musical',
  ARTS_CRAFTS: 'Arts & crafts',
};

export const AGE_BANDS = [
  { code: '0-1', label: '0–12 months', minMonths: 0, maxMonths: 12 },
  { code: '1-3', label: '1–3 years', minMonths: 12, maxMonths: 36 },
  { code: '3-5', label: '3–5 years', minMonths: 36, maxMonths: 60 },
  { code: '5-8', label: '5–8 years', minMonths: 60, maxMonths: 96 },
  { code: '8+', label: '8+ years', minMonths: 96, maxMonths: 216 },
] as const;
export type AgeBand = (typeof AGE_BANDS)[number]['code'];

export const ZONE_TYPES = ['FAST', 'MEDIUM', 'SLOW'] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export const TIER_CODES = ['BASIC', 'PRO', 'ULTRA'] as const;
export type TierCode = (typeof TIER_CODES)[number];

export const DURATION_CODES = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type DurationCode = (typeof DURATION_CODES)[number];

export const BILLING_CYCLES = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUSES = ['PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INTERACTION_TYPES = ['VIEW', 'WISHLIST', 'RENT', 'RATING'] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];
