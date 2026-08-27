import { useEffect, useRef } from 'react';
import { statsAreStale } from '../features/experience/liveStats';
import type { AppState, UiRequest } from '../models/messages';

/**
 * Fetches live experience stats as soon as a surface showing them appears.
 *
 * The button that used to be the only way in is still there for a manual refresh, but a
 * panel that opens with empty fields and a "load" button is asking the user to do work
 * the extension can do itself.
 *
 * Two guards keep that from turning into a request loop. Every fetch answers with a new
 * AppState, which re-renders this component, so without them the effect would re-fire on
 * its own result forever:
 *
 *   1. staleness - anything inside the cache window is left alone, and the request
 *      scheduler would serve it from cache anyway
 *   2. a per-place ref - one request per experience per mount, even while the first is
 *      still in flight and `liveStats` is therefore still null
 */
export function useLiveStats(
  state: AppState | null,
  send: (request: UiRequest) => void,
  active = true,
): void {
  const requestedFor = useRef<string | null>(null);

  const placeId = state?.experience?.placeId ?? null;
  const universeId = state?.experience?.universeId ?? null;
  const stats = state?.liveStats ?? null;

  useEffect(() => {
    if (!active || !placeId) return;
    // No universe means the place has not resolved yet; there is nothing to ask about.
    if (!universeId) return;
    if (requestedFor.current === placeId && !statsAreStale(stats)) return;
    if (!statsAreStale(stats)) return;

    requestedFor.current = placeId;
    send({ type: 'stats/refresh', placeId });
  }, [active, placeId, universeId, stats, send]);

  // Moving to another experience makes the previous request irrelevant.
  useEffect(() => {
    if (requestedFor.current !== null && requestedFor.current !== placeId) {
      requestedFor.current = null;
    }
  }, [placeId]);
}
