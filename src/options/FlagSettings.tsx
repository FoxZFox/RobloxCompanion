import { useState } from 'react';
import { FLAG_ICON_CHOICES, MAX_FLAG_NAME_LENGTH } from '../models/flags';
import type { AppState, UiRequest } from '../models/messages';
import { Section } from './controls';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * Custom flags (spec section 22).
 *
 * Two things are made explicit at creation time because both change what the flag does
 * and neither can be inferred: whether it skips the server in Smart Join, and whether it
 * belongs to this experience only or to all of them.
 */
export function FlagSettings({ state, busy, send }: Props): React.JSX.Element {
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
    <Section title="Your flags">

      <p className="rc-header__sub" style={{ marginTop: 0 }}>
        The built-in statuses cover broken and hostile servers. These are for whatever your
        game actually needs — "no guardian", "good farming", "AFK server".
      </p>

      {state.allCustomFlags.length === 0 ? (
        <div className="rc-empty" style={{ padding: '12px' }}>
          No flags yet.
        </div>
      ) : (
        <div className="rc-region-list" style={{ marginBottom: 10 }}>
          {state.allCustomFlags.map((flag) => (
            <div className="rc-region" key={flag.id}>
              <span aria-hidden="true">{flag.icon}</span>
              <span className="rc-region__name">
                {flag.name}
                <span className="rc-header__sub" style={{ marginLeft: 6 }}>
                  {flag.placeId ? `this experience only` : 'every experience'}
                  {flag.avoid ? ' · skipped by Smart Join' : ''}
                </span>
              </span>
              <button
                type="button"
                className="rc-icon-btn"
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
                className="rc-icon-btn"
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
          <label className="rc-field__label" htmlFor="rc-flag-name">
            New flag
          </label>
          <input
            id="rc-flag-name"
            className="rc-input"
            value={name}
            maxLength={MAX_FLAG_NAME_LENGTH}
            placeholder="No guardian"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="rc-field">
          {/*
            A caption over a row of buttons, not a label for one control: `htmlFor` has
            nothing single to point at, so the row is named as a group instead. Without
            this the icon buttons announce themselves with no idea what they choose.
          */}
          <span className="rc-field__label" id="rc-flag-icon-label">
            Icon
          </span>
          <div className="rc-flagpicker" role="group" aria-labelledby="rc-flag-icon-label">
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
              {experienceName ? `Only for ${experienceName}` : 'Only for the current experience'}
            </span>
          </span>
          {!placeId ? (
            <span className="rc-header__sub" style={{ paddingLeft: 24 }}>
              Open a Roblox experience to scope a flag to it. Created here, it applies everywhere.
            </span>
          ) : null}
        </label>

        <button type="submit" className="rc-btn rc-btn--primary" disabled={busy || !name.trim()}>
          Add flag
        </button>
      </form>
    </Section>
  );
}
