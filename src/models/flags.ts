/**
 * A flag the user invented themselves (spec section 22).
 *
 * The built-in reputation statuses answer "is this server broken or hostile". Custom
 * flags answer whatever the user actually cares about in the game they play - "no
 * guardian", "good farming", "AFK server" - which we cannot know in advance. They are
 * therefore free-form, and the only thing the extension does with them mechanically is
 * honour `avoid`.
 */
export interface CustomFlag {
  id: string;
  name: string;
  /** A single emoji. Kept as text so nothing has to be fetched or bundled. */
  icon: string;
  /** Skip servers carrying this flag in Join Lowest, Random and Smart Join. */
  avoid: boolean;
  /**
   * Scope. Undefined means the flag applies to every experience; a placeId confines it
   * to one, which is what makes per-game vocabularies possible (spec section 21).
   */
  placeId?: string;
  createdAt: number;
}

export type CustomFlagMap = Record<string, CustomFlag>;

export const FLAG_ICON_CHOICES: readonly string[] = [
  '\u{1F423}', // hatching chick
  '\u{1F41B}', // bug
  '\u{1F4B0}', // money bag
  '\u{1F634}', // sleeping face
  '\u{1F40C}', // snail
  '\u{1F525}', // fire
  '\u{2B50}', // star
  '\u{1F3AF}', // direct hit
  '\u{1F6E1}', // shield
  '\u{1F480}', // skull
];

export const MAX_FLAG_NAME_LENGTH = 24;

/** Flags that apply to a given experience: the global ones plus that place's own. */
export function flagsForPlace(flags: CustomFlag[], placeId: string | undefined): CustomFlag[] {
  return flags
    .filter((flag) => flag.placeId === undefined || flag.placeId === placeId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** The subset whose `avoid` is set, as an id set for cheap lookup during filtering. */
export function avoidableFlagIds(flags: CustomFlag[]): Set<string> {
  return new Set(flags.filter((flag) => flag.avoid).map((flag) => flag.id));
}
