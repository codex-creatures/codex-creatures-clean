// lib/dungeon/witch.ts
// The card witch: a game of higher or lower, played in a Labyrinth room.
//
// - Her deck holds the cards 1 to 11 once in each of three suits: Melee ⚔️,
//   Ranged 🏹 and Magic 🔮 (instead of hearts and spades), so 33 cards.
// - Every card, the first one included, is drawn from what's left of the deck,
//   each card equally likely. A card that's been played is gone, so after a
//   7 or two the next card is less likely to be a 7.
// - Each turn you guess whether the next card is higher or lower.
//   - Right: +1 correct guess.
//   - Stick (the same number): nothing happens, guess again.
//   - Wrong: you lose. The witch lunges and stabs one of your creatures
//     (see curse() in run.ts): it loses 15% of its max HP for each of the
//     next 3 actions.
// - She offers you a game when you walk in; you sit down at her table or walk on.
// - Her prize for the next right guess lies face up on the table (a creature
//   card, rolled like a scan), to tempt you into one more, with the prize after
//   it face down behind (you can see its rarity). Guess right and it's yours,
//   the one behind comes forward and a new one goes behind it. You can walk away whenever
//   you like with the cards you've won, and she turns over the card that
//   would have come next. After MAX_CORRECT her prizes are spent and you walk
//   away with them anyway. Lose and you lose them all.

export type Suit = "melee" | "ranged" | "magic";
export const SUITS: Suit[] = ["melee", "ranged", "magic"];
export const SUIT_INFO: Record<Suit, { name: string; icon: string; color: string }> = {
  melee:  { name: "Melee",  icon: "⚔️", color: "#ff9f43" },
  ranged: { name: "Ranged", icon: "🏹", color: "#6fdc6f" },
  magic:  { name: "Magic",  icon: "🔮", color: "#c08cff" },
};

export const LOW = 1;
export const HIGH = 11;
export const MAX_CORRECT = 10;

export type WitchCard = { n: number; suit: Suit };
export type Guess = "higher" | "lower";
export type WitchResult = "right" | "stick" | "wrong";
export type WitchGame = {
  card: WitchCard;          // the card showing
  history: WitchCard[];     // earlier cards, oldest first
  correct: number;
  prize?: string;           // the creature card on offer for the next right guess
  nextPrize?: string;       // the prize after it, face down behind (none once her prizes run out)
  seated?: boolean;         // you took her up on her game
  won?: string[];           // the creature cards won so far (creature ids)
  state: "playing" | "lost" | "left";
  last?: { guess: Guess; result: WitchResult };
  peek?: WitchCard;         // the card that would have come next, turned over when you walk away
};

type Rng = () => number;
type Table = Pick<WitchGame, "card" | "history">;

// The full deck: 1 to 11 in each suit.
export const DECK: WitchCard[] = SUITS.flatMap((suit) => Array.from({ length: HIGH - LOW + 1 }, (_, i) => ({ n: LOW + i, suit })));

// What's left of her deck: every card not yet played (the history and the card showing).
// Worked out from the cards played, so a game saved before the deck still works.
export function remaining(game: Table): WitchCard[] {
  const played = [...game.history, game.card];
  return DECK.filter((c) => !played.some((p) => p.n === c.n && p.suit === c.suit));
}

const pick = (cards: WitchCard[], rng: Rng) => cards[Math.floor(rng() * cards.length)];

// rollPrize: a creature card (its id), rolled like a scan.
export function newWitchGame(rng: Rng = Math.random, rollPrize?: () => string): WitchGame {
  return { card: pick(DECK, rng), history: [], correct: 0, state: "playing",
    ...(rollPrize ? { prize: rollPrize(), nextPrize: rollPrize(), won: [] } : {}) };
}

// Taking a seat at her table.
export const sitDown = (game: WitchGame): WitchGame => (game.state === "playing" ? { ...game, seated: true } : game);
// Are you at her table? (a game already underway, from before you had to sit down, counts)
export const isSeated = (game: WitchGame) => !!game.seated || game.history.length > 0;

// The next card off the deck.
export const drawNext = (game: Table, rng: Rng = Math.random): WitchCard => pick(remaining(game), rng);

// Your odds for a guess right now: [right, stick, wrong].
export function odds(game: Table, g: Guess): [number, number, number] {
  const left = remaining(game);
  const n = game.card.n;
  const share = (f: (c: WitchCard) => boolean) => left.filter(f).length / left.length;
  const right = share((c) => (g === "higher" ? c.n > n : c.n < n));
  const stick = share((c) => c.n === n);
  return [right, stick, 1 - right - stick];
}

export function guess(game: WitchGame, g: Guess, rng: Rng = Math.random, rollPrize?: () => string): WitchGame {
  if (game.state !== "playing") return game;
  if (remaining(game).length === 0) return { ...game, state: "left" }; // (can't happen within MAX_CORRECT, but just in case)
  const next = drawNext(game, rng);
  const result: WitchResult = next.n === game.card.n ? "stick" : (next.n > game.card.n) === (g === "higher") ? "right" : "wrong";
  const correct = game.correct + (result === "right" ? 1 : 0);
  const state = result === "wrong" ? "lost" : correct >= MAX_CORRECT ? "left" : "playing";
  // Right: the prize is yours, the one behind it comes forward, and a new one
  // goes behind (unless that's more prizes than she has).
  const won = result === "right" && game.prize ? [...(game.won ?? []), game.prize] : game.won;
  const right = result === "right" && state === "playing";
  const prize = result !== "right" ? game.prize : right ? game.nextPrize ?? rollPrize?.() : undefined;
  const nextPrize = result !== "right" ? game.nextPrize : right && rollPrize && correct + 1 < MAX_CORRECT ? rollPrize() : undefined;
  const after: WitchGame = { ...game, card: next, history: [...game.history, game.card], correct, state, last: { guess: g, result }, won, prize, nextPrize };
  return state === "left" ? withPeek(after, rng) : after;
}

// Leaving the table, she turns over the card that would have come next.
function withPeek(game: WitchGame, rng: Rng): WitchGame {
  const left = remaining(game);
  return left.length ? { ...game, peek: pick(left, rng) } : game;
}

// Walk away with your cards.
export const walkAway = (game: WitchGame, rng: Rng = Math.random): WitchGame =>
  (game.state === "playing" ? withPeek({ ...game, state: "left" }, rng) : game);
