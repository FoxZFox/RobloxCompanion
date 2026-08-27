import { describe, expect, it } from 'vitest';
import { REGIONS, REGION_RANGES, selectableRegions } from './regionData';
import { isPrivate, parseCidr, parseIpv4, RegionTable } from './regionTable';

describe('parseIpv4', () => {
  it('parses a dotted quad', () => {
    expect(parseIpv4('0.0.0.0')).toBe(0);
    expect(parseIpv4('255.255.255.255')).toBe(4294967295);
    expect(parseIpv4('128.116.97.33')).toBe(((128 << 24) | (116 << 16) | (97 << 8) | 33) >>> 0);
  });

  it('rejects malformed input rather than coercing it', () => {
    // A lenient parser would map junk onto a real city, and a confidently wrong region
    // is worse than admitting we do not know.
    for (const bad of ['10.1', '1.2.3.4.5', '256.0.0.1', 'abc', '', '1.2.3.-1', '1.2.3.04x']) {
      expect(parseIpv4(bad)).toBeNull();
    }
  });

  it('returns an unsigned value for high addresses', () => {
    expect(parseIpv4('200.0.0.1')).toBeGreaterThan(0);
  });
});

describe('parseCidr', () => {
  it('parses a valid range', () => {
    expect(parseCidr('128.116.97.0/24')).toEqual({
      network: parseIpv4('128.116.97.0'),
      prefixLength: 24,
    });
  });

  it('rejects bad prefixes and malformed ranges', () => {
    for (const bad of ['128.116.97.0/33', '128.116.97.0/-1', '128.116.97.0', 'x/24', '/24']) {
      expect(parseCidr(bad)).toBeNull();
    }
  });
});

describe('isPrivate', () => {
  it('recognises the internal ranges Roblox reports as MachineAddress', () => {
    // joinScript.MachineAddress comes back as 10.x behind UDMUX and says nothing about
    // location, so it must never resolve to a region.
    expect(isPrivate(parseIpv4('10.182.1.17')!)).toBe(true);
    expect(isPrivate(parseIpv4('172.16.0.1')!)).toBe(true);
    expect(isPrivate(parseIpv4('192.168.1.1')!)).toBe(true);
    expect(isPrivate(parseIpv4('127.0.0.1')!)).toBe(true);
    expect(isPrivate(parseIpv4('169.254.1.1')!)).toBe(true);
  });

  it('does not flag public Roblox addresses as private', () => {
    expect(isPrivate(parseIpv4('128.116.97.33')!)).toBe(false);
    expect(isPrivate(parseIpv4('172.32.0.1')!)).toBe(false); // just outside 172.16/12
  });
});

describe('RegionTable', () => {
  const table = new RegionTable();

  it('resolves the address shape a real probe returns', () => {
    // 128.116.97.33 is the UdmuxEndpoints address from a documented join response.
    expect(table.lookup('128.116.97.33')?.id).toBe('singapore');
  });

  it('resolves a spread of datacenters', () => {
    expect(table.lookup('128.116.55.10')?.city).toBe('Tokyo');
    expect(table.lookup('128.116.33.7')?.city).toBe('London');
    expect(table.lookup('128.116.115.200')?.city).toBe('Seattle');
    expect(table.lookup('209.206.42.9')?.city).toBe('San Jose');
  });

  it('returns null for an internal address instead of guessing', () => {
    expect(table.lookup('10.182.1.17')).toBeNull();
  });

  it('returns null for a public address outside the table', () => {
    // A gap in our data, which the caller reports as "unmatched", never as a nearest guess.
    expect(table.lookup('8.8.8.8')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(table.lookup('not-an-ip')).toBeNull();
    expect(table.lookup('')).toBeNull();
  });

  it('respects boundaries of a /24', () => {
    expect(table.lookup('128.116.97.0')?.id).toBe('singapore');
    expect(table.lookup('128.116.97.255')?.id).toBe('singapore');
    expect(table.lookup('128.116.98.0')?.id).not.toBe('singapore');
  });

  it('prefers the longest matching prefix', () => {
    const custom = new RegionTable([
      { cidr: '128.116.0.0/16', regionId: 'tokyo' },
      { cidr: '128.116.97.0/24', regionId: 'singapore' },
    ]);
    expect(custom.lookup('128.116.97.5')?.id).toBe('singapore');
    expect(custom.lookup('128.116.5.5')?.id).toBe('tokyo');
  });

  it('skips malformed ranges without breaking the rest of the table', () => {
    const custom = new RegionTable([
      { cidr: 'garbage', regionId: 'tokyo' },
      { cidr: '128.116.97.0/24', regionId: 'singapore' },
    ]);
    expect(custom.size).toBe(1);
    expect(custom.lookup('128.116.97.5')?.id).toBe('singapore');
  });
});

describe('region data integrity', () => {
  it('every range points at a region that exists', () => {
    for (const range of REGION_RANGES) {
      expect(REGIONS[range.regionId], `missing region ${range.regionId}`).toBeDefined();
    }
  });

  it('every range parses', () => {
    for (const range of REGION_RANGES) {
      expect(parseCidr(range.cidr), `bad cidr ${range.cidr}`).not.toBeNull();
    }
  });

  it('hides retired datacenters from the preference picker but still resolves them', () => {
    const selectable = selectableRegions().map((r) => r.id);
    expect(selectable).not.toContain('hongkong');
    // Old cached probe results must still render a name rather than breaking.
    expect(REGIONS.hongkong).toBeDefined();
  });

  it('offers a usable set of regions to choose from', () => {
    expect(selectableRegions().length).toBeGreaterThan(10);
  });
});
