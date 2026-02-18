/**
 * Human-readable ID generator for hauls.
 * Produces IDs like "swift-fox-42" (~225K combinations).
 */

const ADJECTIVES = [
  'bold', 'brave', 'bright', 'calm', 'clean', 'clear', 'clever', 'cool',
  'crisp', 'deft', 'eager', 'fair', 'fast', 'firm', 'fond', 'free',
  'fresh', 'glad', 'gold', 'grand', 'great', 'green', 'happy', 'keen',
  'kind', 'light', 'live', 'lucky', 'mild', 'neat', 'nice', 'noble',
  'plain', 'prime', 'proud', 'pure', 'quick', 'quiet', 'rapid', 'rich',
  'sharp', 'shiny', 'sleek', 'smart', 'smooth', 'snug', 'soft', 'steady',
  'still', 'strong', 'sunny', 'sure', 'sweet', 'swift', 'tall', 'tidy',
  'true', 'vivid', 'warm', 'wise',
];

const NOUNS = [
  'ant', 'ape', 'bass', 'bat', 'bear', 'bee', 'bird', 'boar',
  'buck', 'bull', 'calf', 'cat', 'clam', 'cod', 'colt', 'crab',
  'crow', 'deer', 'doe', 'dove', 'drum', 'duck', 'eagle', 'eel',
  'elk', 'fawn', 'fern', 'finch', 'fish', 'frog', 'goat', 'hawk',
  'hen', 'hog', 'jay', 'kite', 'lark', 'lion', 'lynx', 'mink',
  'mole', 'moth', 'newt', 'orca', 'owl', 'ox', 'pike', 'pony',
  'puma', 'ram', 'ray', 'robin', 'seal', 'slug', 'snail', 'swan',
  'toad', 'trout', 'vole', 'wolf',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateHaulId(): string {
  const adj = pick(ADJECTIVES);
  const noun = pick(NOUNS);
  const num = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${adj}-${noun}-${num}`;
}

export function isValidHaulId(id: string): boolean {
  return /^[a-z]+-[a-z]+-\d{2,3}$/.test(id);
}
