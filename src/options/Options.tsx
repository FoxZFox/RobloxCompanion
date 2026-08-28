import '../components/theme.css';
import '../components/CommandCenter.css';
import { FEATURES, isImplemented } from '../config/features';
import { useAppState } from '../hooks/useAppState';
import { useThemeTokens } from '../hooks/useThemeTokens';
import type { UiRequest } from '../models/messages';
import { Row, Section, Toggle } from './controls';
import { SmartJoinSettings } from './SmartJoinSettings';
import { FlagSettings } from './FlagSettings';
import { DataSettings } from './DataSettings';
import { ThemeSettings } from './ThemeSettings';
import { ProfileSettings } from './ProfileSettings';
import { PlaytimeSettings } from './PlaytimeSettings';
import { OptionalAccess } from './OptionalAccess';
import { OPTIONAL_ORIGINS } from '../services/roblox/endpoints';

const PRESENCE = [OPTIONAL_ORIGINS.presence];

/**
 * Settings (spec section 25).
 *
 * The feature list renders straight from config/features.ts, so a feature cannot exist
 * without a switch, and a switch cannot exist for a feature that has not been built:
 * anything unbuilt is rendered disabled with its phase named, rather than offered and
 * quietly doing nothing. That last part only became true once each feature carried its
 * own `shipped` flag - phases do not ship in order, and the watermark this used to read
 * left every phase 8 and 9 toggle switchable and inert.
 */
export function Options(): React.JSX.Element {
  const { state, busy, send } = useAppState();
  useThemeTokens(state);

  const dispatch = (request: UiRequest): void => {
    void send(request);
  };

  if (!state) return <div className="rc-root"><div className="rc-empty">Loading…</div></div>;

  const { settings } = state;

  return (
    <div className="rc-root" style={{ maxWidth: 720, margin: '0 auto', minHeight: '100vh' }}>
      <header className="rc-header">
        <h1 className="rc-header__title">
          Roblox Companion
          <div className="rc-header__sub">Settings</div>
        </h1>
      </header>

      {/* A landmark, so the settings can be jumped to without walking the header. */}
      <main className="rc-body" aria-busy={busy}>
        <Section title="General">
          <Row
            label="Clicking the toolbar icon opens"
            hint="The in-page panel floats over Roblox itself and can be dragged anywhere; the side panel takes a fixed slice of the window; the popup closes as soon as you alt-tab. Chrome only lets the side panel be opened by the icon itself, so this setting controls the icon directly."
          >
            {(ids) => (
              <select
                id={ids.id}
                aria-describedby={ids.describedBy}
                className="rc-select"
                value={settings.surface}
                disabled={busy}
                onChange={(e) =>
                  dispatch({
                    type: 'settings/set',
                    patch: { surface: e.target.value as 'inpage' | 'panel' | 'popup' },
                  })
                }
              >
                <option value="inpage">In-page panel (recommended)</option>
                <option value="panel">Side Panel</option>
                <option value="popup">Popup</option>
              </select>
            )}
          </Row>

          <Toggle
            label="Developer mode"
            hint="Show API requests, ids and cache state for debugging."
            checked={settings.developerMode}
            disabled={busy}
            onChange={(developerMode) => dispatch({ type: 'settings/set', patch: { developerMode } })}
          />
        </Section>

        <Section title="Features">
          {FEATURES.map((feature) => {
            const available = isImplemented(feature);
            return (
              <Toggle
                key={feature.key}
                label={feature.label}
                hint={
                  available
                    ? feature.description
                    : `${feature.description} (arrives in phase ${feature.phase})`
                }
                checked={available && settings.features[feature.key]}
                disabled={busy || !available}
                onChange={(value) =>
                  dispatch({ type: 'settings/set', patch: { features: { [feature.key]: value } } })
                }
              />
            );
          })}
        </Section>

        <SmartJoinSettings state={state} busy={busy} send={dispatch} />

        <ThemeSettings state={state} busy={busy} send={dispatch} />

        <PlaytimeSettings state={state} busy={busy} send={dispatch} />

        {settings.features.profiles ? <ProfileSettings /> : null}

        <FlagSettings state={state} busy={busy} send={dispatch} />

        <Section title="Server Browser">
          <Row label="Sort by players">
            {(ids) => (
              <select
                id={ids.id}
                className="rc-select"
                value={settings.serverBrowser.sort}
                disabled={busy}
                onChange={(e) =>
                  dispatch({
                    type: 'settings/set',
                    patch: { serverBrowser: { sort: e.target.value as 'Asc' | 'Desc' } },
                  })
                }
              >
                <option value="Asc">Lowest first</option>
                <option value="Desc">Highest first</option>
              </select>
            )}
          </Row>

          <Toggle
            label="Exclude full servers"
            hint="Applied by Roblox as a query parameter, so it also changes what can be paginated."
            checked={settings.serverBrowser.excludeFull}
            disabled={busy}
            onChange={(excludeFull) =>
              dispatch({ type: 'settings/set', patch: { serverBrowser: { excludeFull } } })
            }
          />

          <Toggle
            label="Hide servers marked clean"
            hint="Useful when you are working through a list checking each server once."
            checked={settings.serverBrowser.hideCleanServers}
            disabled={busy}
            onChange={(hideCleanServers) =>
              dispatch({ type: 'settings/set', patch: { serverBrowser: { hideCleanServers } } })
            }
          />

          <Row label="Maximum players" hint="0 turns this filter off.">
            {(ids) => (
              <input
                id={ids.id}
                aria-describedby={ids.describedBy}
                type="number"
                className="rc-input"
                min={0}
                value={settings.serverBrowser.maxPlayerCount}
                disabled={busy}
                onChange={(e) =>
                  dispatch({
                    type: 'settings/set',
                    patch: { serverBrowser: { maxPlayerCount: Number(e.target.value) || 0 } },
                  })
                }
              />
            )}
          </Row>

          <Row
            label="How many servers to load"
            hint="Under 'lowest first' Roblox returns the emptiest servers on page one, so Join Lowest and Smart Join already have what they need there. More pages take longer and mainly help when browsing."
          >
            {(ids) => (
              <select
                id={ids.id}
                aria-describedby={ids.describedBy}
                className="rc-select"
                value={settings.serverBrowser.scanPages}
                disabled={busy}
                onChange={(e) =>
                  dispatch({
                    type: 'settings/set',
                    patch: { serverBrowser: { scanPages: Number(e.target.value) } },
                  })
                }
              >
                <option value={1}>100 — fastest</option>
                <option value={2}>200 — balanced</option>
                <option value={3}>300</option>
                <option value={5}>500 — as deep as Roblox allows</option>
              </select>
            )}
          </Row>
        </Section>

        <Section title="Avoid">
          <Toggle
            label="Skip exploiter servers"
            hint="Applies to both the list and to Join Lowest / Random."
            checked={settings.avoid.exploiterServers}
            disabled={busy}
            onChange={(exploiterServers) =>
              dispatch({ type: 'settings/set', patch: { avoid: { exploiterServers } } })
            }
          />
          <Toggle
            label="Skip bugged servers"
            checked={settings.avoid.buggedServers}
            disabled={busy}
            onChange={(buggedServers) =>
              dispatch({ type: 'settings/set', patch: { avoid: { buggedServers } } })
            }
          />
          <Toggle
            label="Skip manually avoided servers"
            checked={settings.avoid.manuallyAvoided}
            disabled={busy}
            onChange={(manuallyAvoided) =>
              dispatch({ type: 'settings/set', patch: { avoid: { manuallyAvoided } } })
            }
          />
          <Toggle
            label="Skip servers with blacklisted players, when detectable"
            hint="Roblox does not disclose who is in a public server, so this almost never applies today. It is here so it takes effect if that ever changes."
            checked={settings.avoid.blacklistedPlayersWhenDetectable}
            disabled={busy}
            onChange={(value) =>
              dispatch({
                type: 'settings/set',
                patch: { avoid: { blacklistedPlayersWhenDetectable: value } },
              })
            }
          />
        </Section>

        <DataSettings state={state} busy={busy} send={dispatch} />

        <Section title="Privacy">
          <p className="rc-header__sub" style={{ marginTop: 0 }}>
            Everything this extension records — server reports, history and your blacklist — is
            stored on this machine only. There is no backend and nothing is uploaded.
          </p>

          <OptionalAccess origins={PRESENCE} label="Access to presence.roblox.com">
            Presence is how the blacklist can answer "is this person in that server" at all.
            It reads other people, so the host is not requested at install — and Roblox
            only answers for those whose own privacy settings allow it.
          </OptionalAccess>

          <Toggle
            label="Allow presence lookups"
            hint="Looks up whether specific users are online. It queries third-party users, so it is off unless you ask for it."
            checked={settings.privacy.allowPresenceChecks}
            disabled={busy}
            onChange={(allowPresenceChecks) =>
              dispatch({ type: 'settings/set', patch: { privacy: { allowPresenceChecks } } })
            }
          />

          <Toggle
            label="Share reports with the community"
            hint="Not available: V1 has no backend. Listed so its absence is explicit."
            checked={false}
            disabled
            onChange={() => undefined}
          />
        </Section>
      </main>
    </div>
  );
}
