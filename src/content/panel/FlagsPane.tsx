import { useState } from 'react';
import { FLAG_ICON_CHOICES, MAX_FLAG_NAME_LENGTH } from '../../models/flags';
import type { AppState, UiRequest } from '../../models/messages';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * Custom flags, managed from inside the page.
 *
 * Deliberately available here and not only in Settings: the moment someone realises they
 * want a flag is while they are looking at the server that needs one, and sending them to
 * a separate options tab to create it loses that moment.
 */
export function FlagsPane({ state, busy, send }: Props): React.JSX.Element {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(FLAG_ICON_CHOICES[0] ?? '\u{2B50}');
  const [avoid, setAvoid] = useState(false);
  const [scoped, setScoped] = useState(true);

  const placeId = state.experience?.placeId;
  const experienceName = state.experience?.name ?? (placeId ? `place ${placeId}` : null);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    send({ type: 'flags/create', name: trimmed, icon, avoid, scoped: scoped && Boolean(placeId) });
    setName('');
    setAvoid(false);
  };

  return (
    <>
      {state.allCustomFlags.length === 0 ? (
        <div className="rc-empty">
          No flags yet.
          <div className="rc-empty__hint">
            Built-in statuses cover broken and hostile servers. Flags are for whatever your
            game needs.
          </div>
        </div>
      ) : (
        <div className="rc-region-list" style={{ marginBottom: 12 }}>
          {state.allCustomFlags.map((flag) => (
            <div className="rc-region" key={flag.id}>
              <span aria-hidden="true">{flag.icon}</span>
              <span className="rc-region__name">
                {flag.name}
                <span className="rc-header__sub" style={{ display: 'block' }}>
                  {flag.placeId ? 'this experience only' : 'every experience'}
                  {flag.avoid ? ' · skipped by Smart Join' : ''}
                </span>
              </span>
              <button
                type="button"
                className="rc-iconbtn"
                aria-label={
                  flag.avoid ? `Stop skipping ${flag.name}` : `Skip servers flagged ${flag.name}`
                }
                aria-pressed={flag.avoid}
                disabled={busy}
                title="Skip servers carrying this flag in Smart Join, Join Lowest and Random"
                onClick={() =>
                  send({ type: 'flags/update', id: flag.id, patch: { avoid: !flag.avoid } })
                }
              >
                {flag.avoid ? '🚫' : '○'}
              </button>
              <button
                type="button"
                className="rc-iconbtn"
                aria-label={`Delete ${flag.name}`}
                disabled={busy}
                title="Deletes the flag and removes it from every server carrying it"
                onClick={() => send({ type: 'flags/remove', id: flag.id })}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="rc-field">
          <label className="rc-field__label" htmlFor="rc-panel-flag-name">
            New flag
          </label>
          <input
            id="rc-panel-flag-name"
            className="rc-input"
            value={name}
            maxLength={MAX_FLAG_NAME_LENGTH}
            placeholder="No guardian"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="rc-field">
          <span className="rc-field__label">Icon</span>
          <div className="rc-flagpicker">
            {FLAG_ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={`rc-flagchip${icon === choice ? ' rc-flagchip--on' : ''}`}
                aria-label={`Use icon ${choice}`}
                aria-pressed={icon === choice}
                disabled={busy}
                onClick={() => setIcon(choice)}
              >
                <span aria-hidden="true">{choice}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="rc-field" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={avoid}
              disabled={busy}
              onChange={(e) => setAvoid(e.target.checked)}
            />
            <span className="rc-field__label" style={{ fontSize: 12 }}>
              Skip these servers in Smart Join
            </span>
          </span>
        </label>

        <label className="rc-field" style={{ cursor: busy || !placeId ? 'not-allowed' : 'pointer' }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={scoped && Boolean(placeId)}
              disabled={busy || !placeId}
              onChange={(e) => setScoped(e.target.checked)}
            />
            <span className="rc-field__label" style={{ fontSize: 12 }}>
              {experienceName ? `Only for ${experienceName}` : 'Only for this experience'}
            </span>
          </span>
        </label>

        <button type="submit" className="rc-btn rc-btn--primary" disabled={busy || !name.trim()}>
          Add flag
        </button>
      </form>
    </>
  );
}
