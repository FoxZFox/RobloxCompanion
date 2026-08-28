import { OPTIONAL_ORIGINS } from '../services/roblox/endpoints';
import type { AppState, UiRequest } from '../models/messages';
import { Section, Toggle } from './controls';
import { explain } from '../config/release';
import { OptionalAccess } from './OptionalAccess';

const PRESENCE = [OPTIONAL_ORIGINS.presence];

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * Session tracking (spec section 23).
 *
 * Until this existed, the extension could only see the moment its own Join button was
 * pressed: joining from Roblox's own page recorded nothing, and leaving a game ended
 * nothing. Following presence fixes both, and the toggle says exactly what it costs -
 * a request a minute about your own account - because a background poll should be a
 * decision somebody made, not a default they inherited.
 */
export function PlaytimeSettings({ state, busy, send }: Props): React.JSX.Element {
  const enabled = state.settings.features.playtime;
  const follow = state.settings.playtime.followPresence;

  return (
    <Section title="Playtime">
      <p className="rc-header__sub" style={{ marginTop: 0 }}>
        {explain(
          'A session starts when you press Join here. On its own that means a game you started from Roblox itself is not counted, and a session you leave keeps counting until something else closes it.',
          'A session starts when you press Join here. Without the setting below, that is the only moment Roblox lets a browser extension observe — so a game you started from Roblox\u2019s own page is not counted, and a session you leave keeps counting until something else closes it.',
        )}
      </p>

      <OptionalAccess origins={PRESENCE} label="Access to presence.roblox.com">
        The host this asks. It is the same one the blacklist uses, requested here because
        nothing about presence is granted at install.
      </OptionalAccess>

      <Toggle
        label="Track sessions from my Roblox presence"
        hint={
          enabled
            ? explain(
                'Asks Roblox where your account is — once a minute while you are in a game, once every five when you are not. Sessions then start and end on their own, whichever way you joined, accurate to about a minute. It reads your account and nobody else.',
                'Asks Roblox where this account is: once a minute while you are in a game, once every five when you are not. It reads your own account and nobody else. A session then starts when you enter a game however you got there, and ends when you leave — so the time is measured rather than assumed, to about a minute either way.',
              )
            : 'Needs Playtime Tracking, which is switched off above.'
        }
        checked={enabled && follow}
        disabled={busy || !enabled}
        onChange={(followPresence) =>
          send({ type: 'settings/set', patch: { playtime: { followPresence } } })
        }
      />

      {/*
        Said plainly rather than buried: this is the one part of the extension that talks
        to Roblox without the user pressing anything, and they should know when it stops.
      */}
      <p className="rc-footnote">
        Polling happens only while Chrome is running, and stops the moment this is switched
        off. Nothing about where you have been is uploaded anywhere — the sessions live in
        this browser, like everything else here.
      </p>
    </Section>
  );
}
