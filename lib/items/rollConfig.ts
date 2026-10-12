// lib/items/rollConfig.ts
// LOCKED V1 roll tuning — shared by weapon and armour rolls.
// Change balance here, not inside the roll functions.

// Chunk size range, as a fraction of the item's TOTAL rarity budget
// (not the points remaining). Legendary 150 → chunks of 8–30.
export const CHUNK_MIN_PCT = 0.05;
export const CHUNK_MAX_PCT = 0.2;

// Chance a chunk goes to a uniformly random stat (with room left).
export const CHAOS_PCT = 0.2;

// Otherwise pick a stat weighted by (room left) ^ WEIGHT_EXPONENT.
export const WEIGHT_EXPONENT = 0.6;
