import type { Region } from '../../models/smartJoin';

/**
 * Roblox datacenter address ranges.
 *
 * PROVENANCE - read before editing.
 *
 * These are factual network-allocation records: which publicly-routable block Roblox
 * announces from which city, derived from public BGP data for AS22697 and from the
 * range lists the Roblox developer community publishes for exactly this purpose. No
 * upstream list carries an explicit licence, so nothing is copied wholesale and this
 * table is kept deliberately small, limited to plain facts, and easy to replace.
 *
 * It is therefore BEST-EFFORT AND INCOMPLETE ON PURPOSE. Roblox adds, moves and retires
 * datacenters without announcing it, so an address that matches nothing here means our
 * table has a gap - NOT that the server has no location. That distinction is carried all
 * the way to the UI as `unmatched`, and is never rendered as a guess.
 *
 * Verified shape: a probe returns joinScript.UdmuxEndpoints[0].Address as a public
 * address such as 128.116.97.33, which falls in 128.116.97.0/24 below (Singapore).
 * joinScript.MachineAddress is a 10.x internal address and is useless for this.
 */

export const REGIONS: Record<string, Region> = {
  seattle: { id: 'seattle', city: 'Seattle', country: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  losangeles: { id: 'losangeles', city: 'Los Angeles', country: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  dallas: { id: 'dallas', city: 'Dallas', country: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  chicago: { id: 'chicago', city: 'Chicago', country: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  atlanta: { id: 'atlanta', city: 'Atlanta', country: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  miami: { id: 'miami', city: 'Miami', country: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  ashburn: { id: 'ashburn', city: 'Ashburn', country: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  newyork: { id: 'newyork', city: 'New York', country: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  london: { id: 'london', city: 'London', country: 'GB', flag: '\u{1F1EC}\u{1F1E7}' },
  amsterdam: { id: 'amsterdam', city: 'Amsterdam', country: 'NL', flag: '\u{1F1F3}\u{1F1F1}' },
  paris: { id: 'paris', city: 'Paris', country: 'FR', flag: '\u{1F1EB}\u{1F1F7}' },
  frankfurt: { id: 'frankfurt', city: 'Frankfurt', country: 'DE', flag: '\u{1F1E9}\u{1F1EA}' },
  warsaw: { id: 'warsaw', city: 'Warsaw', country: 'PL', flag: '\u{1F1F5}\u{1F1F1}' },
  mumbai: { id: 'mumbai', city: 'Mumbai', country: 'IN', flag: '\u{1F1EE}\u{1F1F3}' },
  tokyo: { id: 'tokyo', city: 'Tokyo', country: 'JP', flag: '\u{1F1EF}\u{1F1F5}' },
  singapore: { id: 'singapore', city: 'Singapore', country: 'SG', flag: '\u{1F1F8}\u{1F1EC}' },
  sydney: { id: 'sydney', city: 'Sydney', country: 'AU', flag: '\u{1F1E6}\u{1F1FA}' },
  hongkong: {
    id: 'hongkong',
    city: 'Hong Kong',
    country: 'HK',
    flag: '\u{1F1ED}\u{1F1F0}',
    retired: true,
  },
  sanjose: {
    id: 'sanjose',
    city: 'San Jose',
    country: 'US',
    flag: '\u{1F1FA}\u{1F1F8}',
    retired: true,
  },
};

export interface RegionRange {
  cidr: string;
  regionId: string;
}

export const REGION_RANGES: readonly RegionRange[] = [
  { cidr: '128.116.115.0/24', regionId: 'seattle' },
  { cidr: '128.116.116.0/24', regionId: 'losangeles' },
  { cidr: '128.116.1.0/24', regionId: 'losangeles' },
  { cidr: '128.116.63.0/24', regionId: 'losangeles' },
  { cidr: '128.116.95.0/24', regionId: 'dallas' },
  { cidr: '128.116.101.0/24', regionId: 'chicago' },
  { cidr: '128.116.48.0/24', regionId: 'chicago' },
  { cidr: '128.116.22.0/24', regionId: 'atlanta' },
  { cidr: '128.116.99.0/24', regionId: 'atlanta' },
  { cidr: '128.116.45.0/24', regionId: 'miami' },
  { cidr: '128.116.127.0/24', regionId: 'miami' },
  { cidr: '128.116.102.0/24', regionId: 'ashburn' },
  { cidr: '128.116.53.0/24', regionId: 'ashburn' },
  { cidr: '128.116.32.0/24', regionId: 'newyork' },
  { cidr: '128.116.33.0/24', regionId: 'london' },
  { cidr: '128.116.119.0/24', regionId: 'london' },
  { cidr: '128.116.21.0/24', regionId: 'amsterdam' },
  { cidr: '128.116.4.0/24', regionId: 'paris' },
  { cidr: '128.116.122.0/24', regionId: 'paris' },
  { cidr: '128.116.5.0/24', regionId: 'frankfurt' },
  { cidr: '128.116.44.0/24', regionId: 'frankfurt' },
  { cidr: '128.116.123.0/24', regionId: 'frankfurt' },
  { cidr: '128.116.31.0/24', regionId: 'warsaw' },
  { cidr: '128.116.124.0/24', regionId: 'warsaw' },
  { cidr: '128.116.104.0/24', regionId: 'mumbai' },
  { cidr: '128.116.55.0/24', regionId: 'tokyo' },
  { cidr: '128.116.120.0/24', regionId: 'tokyo' },
  { cidr: '128.116.50.0/24', regionId: 'singapore' },
  { cidr: '128.116.97.0/24', regionId: 'singapore' },
  { cidr: '128.116.51.0/24', regionId: 'sydney' },
  { cidr: '128.116.30.0/24', regionId: 'hongkong' },
  { cidr: '128.116.118.0/24', regionId: 'hongkong' },
  { cidr: '128.116.117.0/24', regionId: 'sanjose' },
  { cidr: '209.206.42.0/24', regionId: 'sanjose' },
  { cidr: '209.206.43.0/24', regionId: 'sanjose' },
];

/** Regions a user can put in their preference list, retired ones excluded. */
export function selectableRegions(): Region[] {
  return Object.values(REGIONS)
    .filter((region) => !region.retired)
    .sort((a, b) => a.city.localeCompare(b.city));
}
