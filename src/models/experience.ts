/** Identity of the experience the user is currently looking at. */
export interface ExperienceContext {
  placeId: string;
  universeId?: string;
  name?: string;
  maxPlayers?: number;
}

/** Per-experience overrides (spec section 21). Phase 4 fills this in. */
export interface ExperienceProfile {
  placeId: string;
  universeId?: string;
  preferredRegions?: string[];
  maxPlayers?: number;
  customFlagIds?: string[];
}
