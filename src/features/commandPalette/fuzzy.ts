export interface FuzzyMatch {
  score: number;
  /** Indices in the haystack that matched, for highlighting. */
  positions: number[];
}

/** Scoring weights. Tuned so that typing initials beats matching mid-word letters. */
const SCORE_WORD_START = 12;
const SCORE_CONSECUTIVE = 8;
const SCORE_MATCH = 2;
const PENALTY_GAP = 1;

function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const previous = text[index - 1] ?? '';
  return previous === ' ' || previous === '-' || previous === '/' || previous === ':';
}

/**
 * Subsequence match with positional scoring.
 *
 * Deliberately not a substring search: people reach a palette by typing initials, so
 * "jls" has to find "Join lowest server". The weights push word-start hits well above
 * mid-word ones so that intent wins over coincidence - "sm" should surface
 * "Smart Join" rather than "Open dashboard" merely because both contain an s and an m.
 *
 * Returns null for no match at all, so callers can drop entries rather than render a
 * list of everything at score zero.
 */
export function fuzzyMatch(haystack: string, needle: string): FuzzyMatch | null {
  const query = needle.trim().toLowerCase();
  if (query.length === 0) return { score: 0, positions: [] };

  const text = haystack.toLowerCase();
  const positions: number[] = [];

  let score = 0;
  let cursor = 0;
  let previousIndex = -1;

  for (const character of query) {
    const found = text.indexOf(character, cursor);
    if (found === -1) return null;

    score += SCORE_MATCH;
    if (isWordStart(text, found)) score += SCORE_WORD_START;
    if (found === previousIndex + 1) score += SCORE_CONSECUTIVE;
    else if (previousIndex !== -1) score -= Math.min(found - previousIndex - 1, 6) * PENALTY_GAP;

    positions.push(found);
    previousIndex = found;
    cursor = found + 1;
  }

  // A short label matching the whole query is a better hit than a long one containing it.
  score += Math.max(0, 10 - Math.floor(haystack.length / 8));
  return { score, positions };
}

/** Splits a label into matched and unmatched runs, for rendering highlights. */
export function highlight(
  label: string,
  positions: number[],
): Array<{ text: string; match: boolean }> {
  if (positions.length === 0) return [{ text: label, match: false }];

  const marks = new Set(positions);
  const parts: Array<{ text: string; match: boolean }> = [];
  let buffer = '';
  let bufferMatch = marks.has(0);

  for (let index = 0; index < label.length; index += 1) {
    const match = marks.has(index);
    if (match !== bufferMatch) {
      if (buffer) parts.push({ text: buffer, match: bufferMatch });
      buffer = '';
      bufferMatch = match;
    }
    buffer += label[index];
  }
  if (buffer) parts.push({ text: buffer, match: bufferMatch });
  return parts;
}
