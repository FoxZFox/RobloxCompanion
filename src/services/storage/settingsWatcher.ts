import { STORAGE_KEYS } from '../../config/constants';

/**
 * Notifies when settings change, from whichever context is listening.
 *
 * This lives in the storage layer for the same reason the repositories do (spec section
 * 36): the shape and the keys of what is stored stay in one place. The theme injector
 * needs to know when the palette changed in the options page in another tab, and the
 * alternative - a raw chrome.storage listener in the content script - would put a storage
 * key somewhere that has no business knowing one.
 */
export function onSettingsChanged(listener: () => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') return;
    if (!(STORAGE_KEYS.settings in changes)) return;
    listener();
  };

  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
