import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, Result, SerializedError, SwEvent, UiRequest } from '../models/messages';

export interface Toast {
  id: number;
  level: 'info' | 'success' | 'error';
  message: string;
}

export interface AppStateBridge {
  state: AppState | null;
  error: SerializedError | null;
  busy: boolean;
  toasts: Toast[];
  send: (request: UiRequest) => Promise<void>;
  dismissToast: (id: number) => void;
}

/**
 * The only channel between a surface and the service worker.
 *
 * Every request answers with a whole AppState rather than a delta, so the popup and the
 * side panel can be open at once without either holding a stale fragment. Surfaces never
 * touch chrome.storage or the Roblox API directly (spec section 36).
 */
export function useAppState(): AppStateBridge {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<SerializedError | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const mounted = useRef(true);

  const send = useCallback(async (request: UiRequest) => {
    setBusy(true);
    try {
      const result = (await chrome.runtime.sendMessage(request)) as Result<AppState> | undefined;
      if (!mounted.current) return;

      if (!result) {
        setError({ code: 'INTERNAL', message: 'Extension is not responding. Try reloading it.' });
        return;
      }
      if (result.ok) {
        setState(result.data);
        setError(null);
      } else {
        // Keep the last good state on screen; an error should not blank the panel.
        setError(result.error);
      }
    } catch (err) {
      if (mounted.current) {
        setError({ code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    mounted.current = true;
    void send({ type: 'state/get' });

    const onEvent = (event: SwEvent): void => {
      if (event.type === 'toast') {
        toastId.current += 1;
        const toast: Toast = { id: toastId.current, level: event.level, message: event.message };
        setToasts((current) => [...current, toast]);
        setTimeout(() => dismissToast(toast.id), 6000);
      } else if (event.type === 'state/changed') {
        void send({ type: 'state/get' });
      }
    };

    chrome.runtime.onMessage.addListener(onEvent);
    return () => {
      mounted.current = false;
      chrome.runtime.onMessage.removeListener(onEvent);
    };
  }, [send, dismissToast]);

  return { state, error, busy, toasts, send, dismissToast };
}
