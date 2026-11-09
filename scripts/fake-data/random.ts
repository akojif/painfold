// A small seeded random number generator (mulberry32), so generated data is
// identical on every run and the committed files can be checked for drift.
export type Random = {
  next: () => number
  int: (min: number, max: number) => number
  pick: <T>(items: readonly T[]) => T
  chance: (probability: number) => boolean
  digits: (count: number) => string
}

export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return {
    next,
    int,
    pick: items => items[int(0, items.length - 1)]!,
    chance: probability => next() < probability,
    digits: count => Array.from({ length: count }, () => int(0, 9)).join(''),
  }
}
