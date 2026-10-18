// lib/dungeon/witch.ts
// The card witch: a game of higher or lower, played in a Labyrinth room.
//
// - Her cards run from 1 to 11, in three suits: Melee ⚔️, Ranged 🏹 and
//   Magic 🔮 (instead of hearts and spades). The first card is START_MIN to
//   START_MAX.
// - Each turn you guess whether the next card is higher or lower. The next
//   card is higher, lower or the same ("stick") at equal odds (only the
//   ones that can happen: nothing is higher than 11). Then its number is
//   picked evenly in that direction.
//   - Right: +1 correct guess.
//   - Stick (the same number): nothing happens, guess again.
//   - Wrong: you lose. The witch lunges and stabs one of your creatures
//     (see curse() in run.ts): it loses 15% of its max HP for each of the
//     next 3 actions.
// - You can walk away whenever you like, with one creature card (rolled
//   like a scan) per correct guess. After MAX_CORRECT her deck is spent and
//   you walk away with them anyway.

export type Suit = "melee" | "ranged" | "magic";
export const SUITS: Suit[] = ["melee", "ranged", "magic"];
export const SUIT_INFO: Record<Suit, { name: string; icon: string; color: string }> = {
  melee:  { name: "Melee",  icon: "⚔️", color: "#ff9f43" },
  ranged: { name: "Ranged", icon: "🏹", color: "#ffd84a" },
  magic:  { name: "Magic",  icon: "🔮", color: "#c08cff" },
};

export const LOW = 1;
export const HIGH = 11;
export const START_MIN = 4;
export const START_MAX = 7;
export const MAX_CORRECT = 10;

export type WitchCard = { n: number; suit: Suit };
export type Guess = "higher" | "lower";
export type WitchResult = "right" | "stick" | "wrong";
export type WitchGame = {
  card: WitchCard;          // the card showing
  history: WitchCard[];     // earlier cards, oldest first
  correct: number;
  state: "playing" | "lost" | "left";
  last?: { guess: Guess; result: WitchResult };
};

type Rng = () => number;
const randInt = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1));
const suit = (rng: Rng): Suit => SUITS[Math.floor(rng() * SUITS.length)];

export function newWitchGame(rng: Rng = Math.random): WitchGame {
  return { card: { n: randInt(START_MIN, START_MAX, rng), suit: suit(rng) }, history: [], correct: 0, state: "playing" };
}

// Which ways the next card can go from here (all at equal odds).
export function outcomes(n: number): ("higher" | "lower" | "same")[] {
  return [...(n < HIGH ? ["higher" as const] : []), ...(n > LOW ? ["lower" as const] : []), "same" as const];
}

export function drawNext(n: number, rng: Rng = Math.random): WitchCard {
  const ways = outcomes(n);
  const way = ways[Math.floor(rng() * ways.length)];
  const next = way === "higher" ? randInt(n + 1, HIGH, rng) : way === "lower" ? randInt(LOW, n - 1, rng) : n;
  return { n: next, suit: suit(rng) };
}

// Your odds for a guess right now: [right, stick, wrong].
export function odds(n: number, g: Guess): [number, number, number] {
  const ways = outcomes(n);
  const share = 1 / ways.length;
  const right = ways.includes(g) ? share : 0;
  return [right, share, 1 - right - share];
}

export function guess(game: WitchGame, g: Guess, rng: Rng = Math.random): WitchGame {
  if (game.state !== "playing") return game;
  const next = drawNext(game.card.n, rng);
  const result: WitchResult = next.n === game.card.n ? "stick" : (next.n > game.card.n) === (g === "higher") ? "right" : "wrong";
  const correct = game.correct + (result === "right" ? 1 : 0);
  const state = result === "wrong" ? "lost" : correct >= MAX_CORRECT ? "left" : "playing";
  return { card: next, history: [...game.history, game.card], correct, state, last: { guess: g, result } };
}

// Walk away with your cards.
export const walkAway = (game: WitchGame): WitchGame => (game.state === "playing" ? { ...game, state: "left" } : game);
