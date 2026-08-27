import type { ScanState } from '../models/messages';
import type { ScanOutcome } from '../models/server';
import { IDLE_SCAN } from './stateBuilder';

/**
 * Progress of the current scan per place, kept out of AppContext because it is pure
 * presentation state: it exists so the UI can show "loading page 3 of 5" and does not
 * influence any decision the extension makes.
 */
const states = new Map<string, ScanState>();

export function getScanState(placeId: string | undefined): ScanState {
  if (!placeId) return IDLE_SCAN;
  return states.get(placeId) ?? IDLE_SCAN;
}

export function setScanState(placeId: string, patch: Partial<ScanState>): ScanState {
  const next = { ...getScanState(placeId), ...patch };
  states.set(placeId, next);
  return next;
}

export function fromOutcome(outcome: ScanOutcome): Partial<ScanState> {
  return {
    status: 'idle',
    scanned: outcome.servers.length,
    page: outcome.pagesFetched,
    complete: outcome.complete,
    truncated: outcome.truncated,
    lastScanAt: outcome.scannedAt,
    canLoadMore: outcome.cursor !== null,
  };
}
