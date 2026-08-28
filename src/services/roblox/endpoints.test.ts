import { describe, expect, it } from 'vitest';
import { privateServerLinkUrl } from './endpoints';

/**
 * The share link is the one URL here built from a secret, so it gets its own test.
 *
 * What is being pinned down is the parameter name. Roblox has two different tokens for a
 * private server - `accessCode`, which the launcher takes, and `joinCode`, which its web
 * links carry - and a link built from the wrong one looks perfectly valid and admits
 * nobody. This will not catch that confusion on its own, but it does stop the parameter
 * silently changing shape underneath the feature.
 */
describe('privateServerLinkUrl', () => {
  it('points at the place page with the join code as privateServerLinkCode', () => {
    expect(privateServerLinkUrl('6924758805', '1234567890')).toBe(
      'https://www.roblox.com/games/6924758805?privateServerLinkCode=1234567890',
    );
  });

  it('escapes a code rather than pasting it into the query raw', () => {
    expect(privateServerLinkUrl('1', 'a b&c=d')).toBe(
      'https://www.roblox.com/games/1?privateServerLinkCode=a+b%26c%3Dd',
    );
  });
});
