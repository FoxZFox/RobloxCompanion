import type { ThemeInput, ThemeTokens } from '../../models/theme';

/**
 * Colour maths for themes, and the gate that keeps user colours out of the CSS parser.
 *
 * The validation here is not defensive tidiness. Settings can arrive from an imported
 * backup file (BackupService applies `bundle.settings` wholesale), so a hand-edited JSON
 * could put any string where a colour belongs, and that string would otherwise be
 * concatenated straight into a stylesheet injected into roblox.com. A value containing
 * `}` would end our rule and start one of its own, on a page where the user signs in.
 * Anything that is not literally a hex colour is therefore refused and the palette falls
 * back to its default - it never reaches the page.
 */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value.trim());
}

/** Lower-cases and expands `#abc` to `#aabbcc` so comparisons and mixing are uniform. */
export function normaliseHex(value: string): string {
  const hex = value.trim().toLowerCase();
  if (hex.length !== 4) return hex;
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

export type Rgb = readonly [number, number, number];

export function parseHex(value: string): Rgb {
  const hex = normaliseHex(value);
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export function toHex([r, g, b]: Rgb): string {
  const channel = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** `weight` is how much of `b` to take: 0 returns `a`, 1 returns `b`. */
export function mix(a: string, b: string, weight: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const w = Math.max(0, Math.min(1, weight));
  return toHex([r1 + (r2 - r1) * w, g1 + (g2 - g1) * w, b1 + (b2 - b1) * w]);
}

/** WCAG relative luminance, used to judge contrast rather than to guess by eye. */
export function relativeLuminance(value: string): number {
  const [r, g, b] = parseHex(value);
  const linear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

const NEAR_BLACK = '#10131a';
const NEAR_WHITE = '#ffffff';

/**
 * Picks the more readable of black and white for text sitting on `background`.
 *
 * Accent colours are the case that matters: a user who picks a pale yellow accent still
 * gets legible button labels, because the label colour is computed from the accent
 * rather than fixed to white when the palette was authored.
 */
export function readableTextOn(background: string): string {
  return contrastRatio(background, NEAR_WHITE) >= contrastRatio(background, NEAR_BLACK)
    ? NEAR_WHITE
    : NEAR_BLACK;
}

/**
 * Derives a full token set from the three colours a person actually chooses.
 *
 * Every intermediate shade is a mix between the background and the text colour, which is
 * what keeps a palette coherent in both directions: on a dark background the derived
 * surfaces get lighter, on a light one they get darker, from the same code.
 */
export function deriveTokens(input: ThemeInput): ThemeTokens {
  const bg = normaliseHex(input.background);
  const text = normaliseHex(input.text);
  const accent = normaliseHex(input.accent);

  return {
    bg,
    bgSubtle: mix(bg, text, 0.06),
    bgRaised: mix(bg, text, 0.1),
    border: mix(bg, text, 0.2),
    borderStrong: mix(bg, text, 0.34),
    text,
    textMuted: mix(text, bg, 0.35),
    textFaint: mix(text, bg, 0.55),
    accent,
    accentText: readableTextOn(accent),
  };
}

/**
 * Replaces any colour that is not a hex literal with the corresponding fallback.
 *
 * Returns the sanitised input alongside the keys that were rejected, so the UI can say
 * which colour it refused rather than silently showing a palette the user did not pick.
 */
export function sanitiseInput(
  input: Partial<ThemeInput> | undefined,
  fallback: ThemeInput,
): { input: ThemeInput; rejected: (keyof ThemeInput)[] } {
  const keys: (keyof ThemeInput)[] = ['background', 'text', 'accent'];
  const rejected: (keyof ThemeInput)[] = [];
  const result = { ...fallback };

  for (const key of keys) {
    const value = input?.[key];
    if (value === undefined) continue;
    if (isHexColor(value)) result[key] = normaliseHex(value);
    else rejected.push(key);
  }

  return { input: result, rejected };
}
