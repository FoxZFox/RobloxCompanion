import { describe, expect, it } from 'vitest';
import {
  SEARCH_LIMIT,
  parseSearch,
  type RawContent,
  type RawSearchResponse,
} from './parseSearch';

/** Shaped after the real omni-search response of 28 Aug 2026. */
const SPONSORED = {
  universeId: 10759627860,
  name: 'the Obby World [NEW]',
  description: '',
  playerCount: 2,
  totalUpVotes: 6,
  totalDownVotes: 9,
  emphasis: false,
  isSponsored: true,
  nativeAdData: 'lPwaw8RpjdYM0E6Yj06c...',
  creatorName: 'Someone',
};

const ORGANIC = {
  universeId: 111,
  name: 'Tower of Hell',
  playerCount: 40_000,
  totalUpVotes: 900,
  totalDownVotes: 100,
  creatorName: 'YXCeptional Studios',
};

function response(...contents: RawContent[][]): RawSearchResponse {
  return { searchResults: contents.map((group) => ({ contentGroupType: 'Game', contents: group })) };
}

describe('parseSearch', () => {
  it('reads the response Roblox actually returned', () => {
    const { results } = parseSearch(response([SPONSORED]));
    expect(results[0]).toEqual({
      universeId: '10759627860',
      name: 'the Obby World [NEW]',
      creatorName: 'Someone',
      playerCount: 2,
      upVotes: 6,
      downVotes: 9,
      sponsored: true,
      rootPlaceId: null,
    });
  });

  it('keeps sponsored results and marks them', () => {
    // Both other options are worse: dropping them is an editorial decision made for the
    // user, and showing them unmarked passes an advertisement off as a search result.
    const { results } = parseSearch(response([SPONSORED, ORGANIC]));
    expect(results).toHaveLength(2);
    expect(results[0]?.sponsored).toBe(true);
    expect(results[1]?.sponsored).toBe(false);
  });

  it('ignores groups that are not experiences', () => {
    // Omni-search also returns users, creators and layout blobs. Rendering those as
    // experiences would produce rows that cannot be opened.
    const body: RawSearchResponse = {
      searchResults: [
        { contentGroupType: 'Creator', contents: [{ universeId: 1, name: 'A creator' }] },
        { contentGroupType: 'Game', contents: [ORGANIC] },
      ],
    };
    const { results } = parseSearch(body);
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Tower of Hell');
  });

  it('lists an experience once even when it appears in two groups', () => {
    // A game commonly appears as both a paid placement and an organic hit; listing it
    // twice reads as a bug.
    const { results } = parseSearch(response([SPONSORED], [{ ...SPONSORED, isSponsored: false }]));
    expect(results).toHaveLength(1);
  });

  it('drops entries with no id or no name rather than rendering blanks', () => {
    const { results } = parseSearch(response([{ name: 'No id' }, { universeId: 5 }, ORGANIC]));
    expect(results).toHaveLength(1);
  });

  it('keeps a missing count distinct from zero', () => {
    // "Nothing was said about this" and "nobody is playing" are different facts, and the
    // UI can only tell them apart if the parser does.
    const { results } = parseSearch(response([{ universeId: 1, name: 'Quiet', playerCount: 0 }]));
    expect(results[0]?.playerCount).toBe(0);
    expect(results[0]?.upVotes).toBeNull();
  });

  it('caps the list but reports how many there were', () => {
    const many = Array.from({ length: SEARCH_LIMIT + 10 }, (_, index) => ({
      universeId: index,
      name: `Game ${index}`,
    }));
    const { results, totalReturned } = parseSearch(response(many));
    expect(results).toHaveLength(SEARCH_LIMIT);
    expect(totalReturned).toBe(SEARCH_LIMIT + 10);
  });

  it('survives a response with no results at all', () => {
    expect(parseSearch({}).results).toEqual([]);
    expect(parseSearch({ searchResults: [] }).totalReturned).toBe(0);
  });

  it('never carries the ad payload any further', () => {
    // nativeAdData is an opaque blob attached to paid placements. It has no use here and
    // nothing good can come of storing or forwarding it.
    const { results } = parseSearch(response([SPONSORED]));
    expect(JSON.stringify(results)).not.toContain('nativeAdData');
    expect(JSON.stringify(results)).not.toContain('lPwaw8');
  });
});

describe('rootPlaceId', () => {
  it('takes the place id straight from the search response', () => {
    // Present in every sample so far, which is a request saved on every click.
    const { results } = parseSearch(
      response([{ universeId: 1, name: 'A game', rootPlaceId: 111363135577981 }]),
    );
    expect(results[0]?.rootPlaceId).toBe('111363135577981');
  });

  it('leaves it null when the response omits it, so the caller can resolve instead', () => {
    const { results } = parseSearch(response([{ universeId: 1, name: 'A game' }]));
    expect(results[0]?.rootPlaceId).toBeNull();
  });
});
