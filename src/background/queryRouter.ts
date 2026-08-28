import type { Result, UiQuery, UiQueryResults } from '../models/messages';
import { serializeError } from '../utils/errors';
import type { AppContext } from './context';
import * as privateServerHandlers from './handlers/privateServerHandlers';

/**
 * The queries that answer with their own payload instead of a whole AppState.
 *
 * There is exactly one, and the bar for adding a second is high: a query exists only
 * because its answer is a secret that must not be copied into every open surface or left
 * in a snapshot (see models/messages.ts). Everything else goes through messageRouter, so
 * the guarantee that two surfaces can never disagree stays intact.
 *
 * A query never broadcasts `state/changed` either - it changes nothing.
 */
export async function handleQuery<Q extends UiQuery>(
  context: AppContext,
  query: Q,
): Promise<Result<UiQueryResults[Q['type']]>> {
  try {
    switch (query.type) {
      case 'query/privateServerLink': {
        const answer = await privateServerHandlers.shareLink(context, query.privateServerId);
        return { ok: true, data: answer };
      }
    }
  } catch (err) {
    return { ok: false, error: serializeError(err) };
  }
}

export function isUiQuery(value: unknown): value is UiQuery {
  if (typeof value !== 'object' || value === null) return false;
  const { type } = value as { type?: unknown };
  return typeof type === 'string' && type.startsWith('query/');
}
