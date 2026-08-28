import type { Result, UiQuery, UiQueryResults } from '../models/messages';

/**
 * Asks the service worker one question and gets one answer back.
 *
 * Deliberately not part of `useAppState`: a query's answer is a secret that must not
 * become React state shared by a whole surface, so it is handed to the caller and
 * nowhere else. Everything that belongs in state still goes through `send`.
 *
 * Not a hook, so the panel (content script) and the extension pages can both use it.
 */
export async function sendQuery<Q extends UiQuery>(
  query: Q,
): Promise<Result<UiQueryResults[Q['type']]>> {
  try {
    const result = (await chrome.runtime.sendMessage(query)) as
      | Result<UiQueryResults[Q['type']]>
      | undefined;

    if (!result) {
      return {
        ok: false,
        error: { code: 'INTERNAL', message: 'Extension is not responding. Try reloading it.' },
      };
    }
    return result;
  } catch (err) {
    return {
      ok: false,
      error: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) },
    };
  }
}
