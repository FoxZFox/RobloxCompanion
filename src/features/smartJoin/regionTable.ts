import type { Region } from '../../models/smartJoin';
import { REGIONS, REGION_RANGES, type RegionRange } from './regionData';

interface CompiledRange {
  /** Network address as an unsigned 32-bit integer. */
  network: number;
  mask: number;
  prefixLength: number;
  regionId: string;
}

/**
 * Parses dotted-quad IPv4 into an unsigned 32-bit integer, or null if malformed.
 *
 * Strict on purpose: a sloppy parser that accepted "10.1" or "1.2.3.4.5" would silently
 * map junk onto a real region, and a confidently wrong city is worse than "unknown".
 */
export function parseIpv4(address: string): number | null {
  const parts = address.trim().split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

export function parseCidr(cidr: string): { network: number; prefixLength: number } | null {
  const [address, prefix] = cidr.split('/');
  if (!address || prefix === undefined) return null;

  const network = parseIpv4(address);
  if (network === null) return null;

  const prefixLength = Number(prefix);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) return null;

  return { network, prefixLength };
}

function compile(ranges: readonly RegionRange[]): CompiledRange[] {
  const compiled: CompiledRange[] = [];
  for (const range of ranges) {
    const parsed = parseCidr(range.cidr);
    if (!parsed) continue;
    // A /0 mask cannot be produced by shifting, so it is special-cased to 0.
    const mask = parsed.prefixLength === 0 ? 0 : (0xffffffff << (32 - parsed.prefixLength)) >>> 0;
    compiled.push({
      network: (parsed.network & mask) >>> 0,
      mask,
      prefixLength: parsed.prefixLength,
      regionId: range.regionId,
    });
  }
  // Longest prefix first, so a more specific range always wins over a broader one.
  return compiled.sort((a, b) => b.prefixLength - a.prefixLength);
}

/**
 * Maps a public Roblox server address to a datacenter.
 *
 * Returns null for anything the table does not cover, which the caller must report as
 * "unknown" rather than falling back to a nearest guess. Private ranges are rejected up
 * front because joinScript.MachineAddress is a 10.x internal address that identifies
 * nothing about location.
 */
export class RegionTable {
  private readonly ranges: CompiledRange[];

  constructor(ranges: readonly RegionRange[] = REGION_RANGES) {
    this.ranges = compile(ranges);
  }

  lookup(address: string): Region | null {
    const value = parseIpv4(address);
    if (value === null) return null;
    if (isPrivate(value)) return null;

    for (const range of this.ranges) {
      if (((value & range.mask) >>> 0) === range.network) {
        return REGIONS[range.regionId] ?? null;
      }
    }
    return null;
  }

  get size(): number {
    return this.ranges.length;
  }
}

/** RFC1918 plus loopback and link-local - none of which say anything about a datacenter. */
export function isPrivate(value: number): boolean {
  const a = (value >>> 24) & 0xff;
  const b = (value >>> 16) & 0xff;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}
