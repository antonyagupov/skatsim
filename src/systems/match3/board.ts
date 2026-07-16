import type { BoardGemId, GemId, SpecialGemId } from "../../assets/types";
import { GEM_IDS, SPECIAL_GEM_ID } from "../../assets/types";

export const BOARD_SIZE = 7;
export const MAX_EXTRA_MOVES_STREAK = 2;

export type Cell = BoardGemId | null;
export type Board = Cell[][];

export type MatchGroup = {
  gem: GemId;
  cells: Array<{ r: number; c: number }>;
  length: number;
};

export type SwapResult =
  | {
      ok: true;
      board: Board;
      matches: MatchGroup[];
      /** Prismatic swapped onto a color — clears that color. */
      prismaticClear?: { color: GemId; prismR: number; prismC: number };
    }
  | {
      ok: false;
      reason: "not_adjacent" | "no_match" | "out_of_bounds" | "empty";
    };

export type CascadeStep = {
  cleared: MatchGroup[];
  boardAfterClear: Board;
  boardAfterGravity: Board;
  boardAfterFill: Board;
  cascadeIndex: number;
  createdSpecial?: { r: number; c: number };
  matchFourCount: number;
  matchFiveCount: number;
};

export type ResolveResult = {
  steps: CascadeStep[];
  finalBoard: Board;
  totals: Record<GemId, number>;
  weightedTotals: Record<GemId, number>;
  cascadeMultiplierPeak: number;
  /** Longest match length seen this resolve (for charge bonuses). */
  longestMatch: number;
  matchFourOccurred: boolean;
  matchFiveOccurred: boolean;
  specialGemsCreated: number;
  prismaticActivations: Array<{ color: GemId; tiles: number }>;
};

export function isSpecialGem(cell: Cell): cell is SpecialGemId {
  return cell === SPECIAL_GEM_ID;
}

export function isColorGem(cell: Cell): cell is GemId {
  return cell !== null && cell !== SPECIAL_GEM_ID;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function randomGem(rng: () => number = Math.random): GemId {
  return GEM_IDS[Math.floor(rng() * GEM_IDS.length)]!;
}

export function createBoard(rng: () => number = Math.random): Board {
  const board = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      let gem = randomGem(rng);
      let guard = 0;
      while (guard++ < 40 && wouldCreateMatchAt(board, r, c, gem)) {
        gem = randomGem(rng);
      }
      board[r]![c] = gem;
    }
  }
  return board;
}

function wouldCreateMatchAt(board: Board, r: number, c: number, gem: GemId): boolean {
  let left = 0;
  for (let cc = c - 1; cc >= 0 && board[r]![cc] === gem; cc--) left++;
  let right = 0;
  for (let cc = c + 1; cc < BOARD_SIZE && board[r]![cc] === gem; cc++) right++;
  if (left + right + 1 >= 3) return true;
  let up = 0;
  for (let rr = r - 1; rr >= 0 && board[rr]![c] === gem; rr--) up++;
  let down = 0;
  for (let rr = r + 1; rr < BOARD_SIZE && board[rr]![c] === gem; rr++) down++;
  return up + down + 1 >= 3;
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE;
}

export function areAdjacent(
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): boolean {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

export function swapCells(
  board: Board,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): Board {
  const next = cloneBoard(board);
  const tmp = next[r1]![c1]!;
  next[r1]![c1] = next[r2]![c2]!;
  next[r2]![c2] = tmp;
  return next;
}

export function findMatches(board: Board): MatchGroup[] {
  const groups: MatchGroup[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    let c = 0;
    while (c < BOARD_SIZE) {
      const gem = board[r]![c];
      if (!isColorGem(gem)) {
        c++;
        continue;
      }
      let end = c + 1;
      while (end < BOARD_SIZE && board[r]![end] === gem) end++;
      if (end - c >= 3) {
        const cells = [];
        for (let cc = c; cc < end; cc++) cells.push({ r, c: cc });
        groups.push({ gem, cells, length: end - c });
      }
      c = end;
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let r = 0;
    while (r < BOARD_SIZE) {
      const gem = board[r]![c];
      if (!isColorGem(gem)) {
        r++;
        continue;
      }
      let end = r + 1;
      while (end < BOARD_SIZE && board[end]![c] === gem) end++;
      if (end - r >= 3) {
        const cells = [];
        for (let rr = r; rr < end; rr++) cells.push({ r: rr, c });
        groups.push({ gem, cells, length: end - r });
      }
      r = end;
    }
  }

  return groups;
}

/** True if any adjacent swap creates a match or activates prismatic. */
export function hasLegalMove(board: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const neighbors = [
        [r, c + 1],
        [r + 1, c],
      ];
      for (const [nr, nc] of neighbors) {
        if (!inBounds(nr!, nc!)) continue;
        const res = trySwap(board, r, c, nr!, nc!);
        if (res.ok) return true;
      }
    }
  }
  return false;
}

/** Reshuffle existing gems; avoid immediate matches; ensure a legal move. */
export function shuffleBoard(
  board: Board,
  rng: () => number = Math.random,
): Board {
  const gems: BoardGemId[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const g = board[r]![c];
      if (g) gems.push(g);
    }
  }

  for (let attempt = 0; attempt < 80; attempt++) {
    // Fisher–Yates — mix attempt so constant rng still permutes
    for (let i = gems.length - 1; i > 0; i--) {
      const j = Math.floor(((rng() + attempt * 0.17) % 1) * (i + 1));
      const tmp = gems[i]!;
      gems[i] = gems[j]!;
      gems[j] = tmp;
    }
    const next = createEmptyBoard();
    let i = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        next[r]![c] = gems[i++]!;
      }
    }
    if (findMatches(next).length === 0 && hasLegalMove(next)) {
      return next;
    }
  }

  // Fallback: solvable board (constant rng alone can fill one color)
  let salt = 0;
  return createBoard(() => {
    salt += 1;
    return (rng() + salt * 0.618033) % 1;
  });
}

export function trySwap(
  board: Board,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): SwapResult {
  if (!inBounds(r1, c1) || !inBounds(r2, c2)) {
    return { ok: false, reason: "out_of_bounds" };
  }
  if (!areAdjacent(r1, c1, r2, c2)) {
    return { ok: false, reason: "not_adjacent" };
  }
  const a = board[r1]![c1];
  const b = board[r2]![c2];
  if (!a || !b) return { ok: false, reason: "empty" };

  // Prismatic + color → clear that color
  if (isSpecialGem(a) && isColorGem(b)) {
    return {
      ok: true,
      board: swapCells(board, r1, c1, r2, c2),
      matches: [],
      prismaticClear: { color: b, prismR: r2, prismC: c2 },
    };
  }
  if (isSpecialGem(b) && isColorGem(a)) {
    return {
      ok: true,
      board: swapCells(board, r1, c1, r2, c2),
      matches: [],
      prismaticClear: { color: a, prismR: r1, prismC: c1 },
    };
  }
  // Two prismatics or prismatic+prismatic — treat as invalid unless matches
  const swapped = swapCells(board, r1, c1, r2, c2);
  const matches = findMatches(swapped);
  if (matches.length === 0) {
    return { ok: false, reason: "no_match" };
  }
  return { ok: true, board: swapped, matches };
}

export function clearMatches(board: Board, matches: MatchGroup[]): Board {
  const next = cloneBoard(board);
  for (const g of matches) {
    for (const { r, c } of g.cells) next[r]![c] = null;
  }
  return next;
}

export function clearColor(
  board: Board,
  color: GemId,
  alsoClear?: { r: number; c: number },
): { board: Board; tiles: number } {
  const next = cloneBoard(board);
  let tiles = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (next[r]![c] === color) {
        next[r]![c] = null;
        tiles++;
      }
    }
  }
  if (alsoClear && next[alsoClear.r]![alsoClear.c] === SPECIAL_GEM_ID) {
    next[alsoClear.r]![alsoClear.c] = null;
  }
  // Also clear prismatic that was activated (may have moved)
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (next[r]![c] === SPECIAL_GEM_ID && alsoClear && alsoClear.r === r && alsoClear.c === c) {
        next[r]![c] = null;
      }
    }
  }
  if (alsoClear) {
    next[alsoClear.r]![alsoClear.c] = null;
  }
  return { board: next, tiles };
}

export function applyGravity(board: Board): Board {
  const next = createEmptyBoard();
  for (let c = 0; c < BOARD_SIZE; c++) {
    const stack: BoardGemId[] = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const gem = board[r]![c];
      if (gem) stack.push(gem);
    }
    let r = BOARD_SIZE - 1;
    for (const gem of stack) {
      next[r]![c] = gem;
      r--;
    }
  }
  return next;
}

export function refillBoard(board: Board, rng: () => number = Math.random): Board {
  const next = cloneBoard(board);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!next[r]![c]) next[r]![c] = randomGem(rng);
    }
  }
  return next;
}

export function cascadeMultiplier(cascadeIndex: number): number {
  if (cascadeIndex <= 0) return 1;
  if (cascadeIndex === 1) return 1.15;
  if (cascadeIndex === 2) return 1.3;
  return Math.min(1.45, 1.3 + (cascadeIndex - 2) * 0.05);
}

export function countCleared(matches: MatchGroup[]): Record<GemId, number> {
  const totals = Object.fromEntries(GEM_IDS.map((g) => [g, 0])) as Record<
    GemId,
    number
  >;
  const seen = new Set<string>();
  for (const g of matches) {
    for (const { r, c } of g.cells) {
      const k = `${r},${c}`;
      if (seen.has(k)) continue;
      seen.add(k);
      totals[g.gem] += 1;
    }
  }
  return totals;
}

function longestInMatches(matches: MatchGroup[]): number {
  let max = 0;
  for (const m of matches) max = Math.max(max, m.length);
  return max;
}

function pickSpecialSpawnCell(matches: MatchGroup[]): { r: number; c: number } | null {
  const five = matches.filter((m) => m.length >= 5);
  if (!five.length) return null;
  const g = five[0]!;
  const mid = g.cells[Math.floor(g.cells.length / 2)]!;
  return mid;
}

/**
 * Resolve board after a successful swap.
 * @param initialPrismatic optional color clear from prismatic activation before cascades
 */
export function resolveBoard(
  boardAfterSwap: Board,
  rng: () => number = Math.random,
  initialPrismatic?: { color: GemId; prismR: number; prismC: number },
): ResolveResult {
  let board = cloneBoard(boardAfterSwap);
  const steps: CascadeStep[] = [];
  const totals = Object.fromEntries(GEM_IDS.map((g) => [g, 0])) as Record<
    GemId,
    number
  >;
  const weighted = Object.fromEntries(GEM_IDS.map((g) => [g, 0])) as Record<
    GemId,
    number
  >;
  let cascadeIndex = 0;
  let peak = 1;
  let longestMatch = 0;
  let matchFourOccurred = false;
  let matchFiveOccurred = false;
  let specialGemsCreated = 0;
  const prismaticActivations: Array<{ color: GemId; tiles: number }> = [];

  if (initialPrismatic) {
    const cleared = clearColor(board, initialPrismatic.color, {
      r: initialPrismatic.prismR,
      c: initialPrismatic.prismC,
    });
    board = cleared.board;
    totals[initialPrismatic.color] += cleared.tiles;
    weighted[initialPrismatic.color] += cleared.tiles;
    prismaticActivations.push({
      color: initialPrismatic.color,
      tiles: cleared.tiles,
    });
    longestMatch = Math.max(longestMatch, cleared.tiles);
    const boardAfterGravity = applyGravity(board);
    const boardAfterFill = refillBoard(boardAfterGravity, rng);
    steps.push({
      cleared: [
        {
          gem: initialPrismatic.color,
          cells: [],
          length: cleared.tiles,
        },
      ],
      boardAfterClear: board,
      boardAfterGravity,
      boardAfterFill,
      cascadeIndex: 0,
      matchFourCount: 0,
      matchFiveCount: 0,
    });
    board = boardAfterFill;
    cascadeIndex = 1;
  }

  while (cascadeIndex < 40) {
    const matches = findMatches(board);
    if (matches.length === 0) break;
    const mult = cascadeMultiplier(cascadeIndex === 0 && !initialPrismatic ? 0 : cascadeIndex);
    peak = Math.max(peak, mult);
    const raw = countCleared(matches);
    for (const g of GEM_IDS) {
      totals[g] += raw[g]!;
      weighted[g] += raw[g]! * mult;
    }
    const len = longestInMatches(matches);
    longestMatch = Math.max(longestMatch, len);
    const matchFourCount = matches.filter((m) => m.length >= 4).length;
    const matchFiveCount = matches.filter((m) => m.length >= 5).length;
    if (matchFourCount > 0) matchFourOccurred = true;
    if (matchFiveCount > 0) matchFiveOccurred = true;

    let boardAfterClear = clearMatches(board, matches);
    let createdSpecial: { r: number; c: number } | undefined;
    if (matchFiveCount > 0) {
      const spawn = pickSpecialSpawnCell(matches);
      if (spawn) {
        boardAfterClear[spawn.r]![spawn.c] = SPECIAL_GEM_ID;
        createdSpecial = spawn;
        specialGemsCreated += 1;
      }
    }

    const boardAfterGravity = applyGravity(boardAfterClear);
    const boardAfterFill = refillBoard(boardAfterGravity, rng);
    steps.push({
      cleared: matches,
      boardAfterClear,
      boardAfterGravity,
      boardAfterFill,
      cascadeIndex,
      createdSpecial,
      matchFourCount,
      matchFiveCount,
    });
    board = boardAfterFill;
    cascadeIndex++;
  }

  // Dead board safety after resolve
  if (!hasLegalMove(board)) {
    board = shuffleBoard(board, rng);
  }

  return {
    steps,
    finalBoard: board,
    totals,
    weightedTotals: weighted,
    cascadeMultiplierPeak: peak,
    longestMatch,
    matchFourOccurred,
    matchFiveOccurred,
    specialGemsCreated,
    prismaticActivations,
  };
}

export function spawnSpecialGemAt(
  board: Board,
  r: number,
  c: number,
): Board {
  const next = cloneBoard(board);
  if (inBounds(r, c)) next[r]![c] = SPECIAL_GEM_ID;
  return next;
}
