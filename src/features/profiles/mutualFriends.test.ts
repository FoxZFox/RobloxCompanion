import { describe, expect, it } from 'vitest';
import { describeMutual, intersectFriends } from './mutualFriends';

describe('intersectFriends', () => {
  it('counts the ids present in both lists', () => {
    const result = intersectFriends([1, 2, 3, 4], [3, 4, 5]);
    expect(result.verdict).toBe('compared');
    expect(result.count).toBe(2);
    expect(result.ownTotal).toBe(4);
    expect(result.theirTotal).toBe(3);
  });

  it('compares by id, which is all Roblox gives us', () => {
    // The friends endpoint returns name and displayName as empty strings (verified
    // 28 Aug 2026), so anything comparing names would match everyone with everyone.
    expect(intersectFriends([10], [10]).count).toBe(1);
  });

  it('reports a hidden list as hidden, not as nothing in common', () => {
    // The distinction the whole feature turns on: "no mutual friends" is a finding,
    // "their list is private" is an absence of one, and they must not read the same.
    const result = intersectFriends([1, 2], null);
    expect(result.verdict).toBe('their-list-private');
    expect(describeMutual(result)).toMatch(/does not disclose/i);
  });

  it('reports our own list being unreadable separately', () => {
    const result = intersectFriends(null, [1, 2]);
    expect(result.verdict).toBe('own-list-unavailable');
    expect(describeMutual(result)).toMatch(/your own/i);
  });

  it('says nothing in common only when it actually compared', () => {
    const result = intersectFriends([1, 2], [3, 4]);
    expect(result.verdict).toBe('compared');
    expect(describeMutual(result)).toBe('No friends in common.');
  });

  it('counts a duplicate in Roblox’s own list once', () => {
    expect(intersectFriends([1], [1, 1, 1]).count).toBe(1);
  });

  it('handles empty lists without claiming a refusal', () => {
    const result = intersectFriends([], []);
    expect(result.verdict).toBe('compared');
    expect(result.count).toBe(0);
  });

  it('uses the singular for one mutual friend', () => {
    expect(describeMutual(intersectFriends([1], [1]))).toBe('1 friend in common.');
  });
});
