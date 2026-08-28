import { useEffect, useState } from 'react';

interface Props {
  /** Match patterns to request together, e.g. a single host for one feature. */
  origins: readonly string[];
  label: string;
  children: React.ReactNode;
}

/**
 * Grants a host permission at the moment a feature needs it, and takes it back.
 *
 * Nothing beyond the four hosts the server browser cannot work without is requested at
 * install (see PERMISSIONS.md). Everything else is asked for here, once, with the reason
 * on screen - and Revoke sits next to Grant, because a permission that cannot be
 * withdrawn from the same place it was given is not really optional.
 *
 * It lives on the options page because `chrome.permissions` does not exist in a content
 * script, so the in-page panel cannot ask; it sends the user here instead.
 */
export function OptionalAccess({ origins, label, children }: Props): React.JSX.Element {
  const [granted, setGranted] = useState<boolean | null>(null);
  const patterns = [...origins];

  useEffect(() => {
    chrome.permissions.contains({ origins: patterns }).then(setGranted, () => setGranted(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the origin list is constant
  }, []);

  /*
   * Called straight out of the click handler with nothing awaited first: Chrome discards
   * the user gesture across an await, and a permission request without one is refused
   * outright - the same rule that governs opening the side panel.
   */
  const request = (): void => {
    void chrome.permissions.request({ origins: patterns }).then(setGranted, () => undefined);
  };

  const revoke = (): void => {
    void chrome.permissions.remove({ origins: patterns }).then(
      (removed) => setGranted(!removed),
      () => undefined,
    );
  };

  return (
    <div className="rc-field">
      {/*
        The state is announced as it changes, not just repainted: granting is a decision
        with consequences, and the only confirmation Chrome gives is this line.
      */}
      <span className="rc-field__label" role="status">
        {label} {granted === null ? '' : granted ? '— granted' : '— not granted'}
      </span>
      <span className="rc-header__sub">{children}</span>
      <div className="rc-btn-row">
        {/*
          Named with the host they act on. Several of these blocks sit on one page, and
          four buttons all called "Grant" say nothing about what is being granted to a
          screen reader listing them.
        */}
        <button
          type="button"
          className="rc-btn"
          aria-label={`Grant ${label}`}
          disabled={granted === true}
          onClick={request}
        >
          Grant
        </button>
        <button
          type="button"
          className="rc-btn"
          aria-label={`Revoke ${label}`}
          disabled={granted !== true}
          onClick={revoke}
        >
          Revoke
        </button>
      </div>
    </div>
  );
}
