import { useEffect } from 'react';
import { describeMutual } from '../features/profiles/mutualFriends';
import type { AppState, UiRequest } from '../models/messages';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
  /** The profile being viewed, resolved by whichever surface knows the current page. */
  userId: string | null;
}

/**
 * Profile tools (phase 8) — mutual friends, and an honest account of when there is none.
 *
 * Reads another person's friend list, so it does so only when the user is on that
 * person's profile and asks. Nothing is stored: the answer lives in the service worker
 * for the session and is replaced the moment a different profile is looked at.
 */
export function ProfilePane({ state, busy, send, userId }: Props): React.JSX.Element {
  const { profile } = state;
  const stale = userId !== null && profile.userId !== userId;

  useEffect(() => {
    if (!userId || !stale) return;
    send({ type: 'profile/mutualFriends', userId });
  }, [userId, stale, send]);

  if (!userId) {
    return (
      <div className="rc-empty">
        Open someone&apos;s Roblox profile to compare friends.
        <div className="rc-empty__hint">
          This only ever looks at a profile you have opened yourself.
        </div>
      </div>
    );
  }

  return (
    <div className="rc-card" style={{ marginBottom: 10 }}>
      <div className="rc-card__label">Mutual friends</div>

      {profile.needsPermission ? (
        <>
          <p className="rc-header__sub" style={{ marginTop: 0 }}>
            Comparing friends needs access to <code>friends.roblox.com</code>, which this
            extension does not ask for at install. Grant it in Settings and this will work
            from then on.
          </p>
          <div className="rc-btn-row">
            <button type="button" className="rc-btn" onClick={() => send({ type: 'ui/openOptions' })}>
              Open Settings
            </button>
          </div>
        </>
      ) : profile.mutual === null || stale ? (
        <p className="rc-header__sub" style={{ marginTop: 0 }}>
          Checking…
        </p>
      ) : (
        <>
          <p style={{ marginTop: 0, fontSize: 13 }}>{describeMutual(profile.mutual)}</p>

          {/*
            The totals are the caveat the count cannot carry on its own: "2 in common" out
            of 40 and out of 800 are different facts about the same number.
          */}
          {profile.mutual.verdict === 'compared' ? (
            <div className="rc-meta">
              <span>they have {profile.mutual.theirTotal} friends</span>
              <span className="rc-meta__sep">·</span>
              <span>you have {profile.mutual.ownTotal}</span>
            </div>
          ) : null}

          <p className="rc-footnote">
            Compared by user id, because Roblox returns friends with their names left
            blank. Names are therefore not shown — a count is what this can honestly give.
          </p>

          <div className="rc-btn-row">
            <button
              type="button"
              className="rc-btn"
              disabled={busy}
              onClick={() => send({ type: 'profile/mutualFriends', userId })}
            >
              Re-check
            </button>
          </div>
        </>
      )}
    </div>
  );
}
