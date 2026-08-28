import type { AppState, UiRequest } from '../models/messages';
import type { PopulationPreference } from '../models/smartJoin';
import { Row, Section, Toggle } from './controls';
import { IS_RELEASE, explain } from '../config/release';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * Smart Join settings (spec section 26).
 *
 * The region controls that used to live here are gone. Roblox gates the only endpoint
 * that reveals a server's datacenter to its own game client, so the setting could not
 * do anything, and a toggle that never works is worse than no toggle. The explanation
 * stays, once, so the absence is accounted for rather than mysterious.
 */
export function SmartJoinSettings({ state, busy, send }: Props): React.JSX.Element {
  const smart = state.settings.smartJoin;
  const privateServers = state.settings.features.privateServers;

  return (
    <Section title="Smart Join">
      <Row
        label="Prefer servers that are"
        hint={explain(
          'Scores the servers already loaded and joins the best one.',
          'Smart Join scores every server already loaded and joins the best one. It makes no extra requests to Roblox.',
        )}
      >
        {(ids) => (
          <select
            id={ids.id}
            aria-describedby={ids.describedBy}
            className="rc-select"
            value={smart.population}
            disabled={busy}
            onChange={(e) =>
              send({
                type: 'settings/set',
                patch: { smartJoin: { population: e.target.value as PopulationPreference } },
              })
            }
          >
            <option value="lowest">Emptiest</option>
            <option value="balanced">Around half full</option>
            <option value="highest">Busiest</option>
          </select>
        )}
      </Row>

      {/*
        Spec section 29. Off by default: it changes where the user lands, which is not
        something to inherit by surprise. Switched on it is also the cheaper path - the
        private list is one request, and finding something in it means no public page is
        fetched at all.
      */}
      <Toggle
        label="Take a private server you can enter here first"
        hint={
          privateServers
            ? explain(
                'If you can enter a private server here, Smart Join takes it instead of a public one. Nothing is created or bought. If there is none, or all are full, it picks a public server as usual.',
                'When Roblox says you may enter a private server on this experience, Smart Join takes it instead of scoring public ones — and says so in Explain Why. Nothing is created and nothing is bought; it uses only servers you already have. If there is none, or every one is full, it scores public servers as usual.',
              )
            : 'Needs the Private Servers feature, which is switched off above.'
        }
        checked={privateServers && smart.preferOwnPrivateServer}
        disabled={busy || !privateServers}
        onChange={(preferOwnPrivateServer) =>
          send({ type: 'settings/set', patch: { smartJoin: { preferOwnPrivateServer } } })
        }
      />

      <div className="rc-field">
        <span className="rc-field__label">Signals used</span>
        <span className="rc-header__sub">
          {explain(
            'How full it is · your own flags · how well the server is running · how long we have known it · favourites. Anything that cannot be judged is left out of the score rather than counted against the server.',
            "Population · Reputation (your own flags) · Health (the server's FPS and how its own players are faring on it) · Freshness (when we first saw the server) · Favourites. A signal that cannot be judged for a given server is left out of its score rather than counted as zero.",
          )}
        </span>
      </div>

      {/*
        This confusion is worth heading off explicitly: the ping figure looks like it
        should answer "which server is nearest me", and it cannot.
      */}
      <div className="rc-field">
        <span className="rc-field__label">Why ping does not tell you what is nearest</span>
        <span className="rc-header__sub">
          {IS_RELEASE ? (
            <>
              The ping shown is the average of the players <em>already in</em> a server, not
              yours. A low number means that server is treating its players well &mdash; it
              says nothing about how near it is to you.
            </>
          ) : (
            <>
              The ping Roblox reports is the average of the players <em>already in</em> a
              server, measured from them to it. Roblox seats people on servers near
              themselves, so a Singapore server full of Singaporeans and a Dallas server full
              of Texans both report roughly 40ms. A low number means that server is treating
              its current players well &mdash; it says nothing about where the server is
              relative to you. Health uses it for the first meaning only.
            </>
          )}
        </span>
      </div>

      {/*
        Verified against live Roblox on 27 Aug 2026: join-game-instance answers a browser
        request with status 12 and no join script. Recording that here means nobody has to
        rediscover it, and it explains why a headline feature is missing.
      */}
      <div className="rc-banner">
        <span>
          {IS_RELEASE ? (
            <>
              <strong>Server region is not available.</strong> Roblox does not tell a browser
              where a server runs. The only way to find out would be to pretend to be the
              Roblox game client, which this extension will not do &mdash; so there is no
              region filter rather than a made-up one.
            </>
          ) : (
            <>
              <strong>Server region is not available.</strong> Roblox publishes no endpoint
              that reports where a server runs. The one call that reveals it is the game
              client's own join request, which refuses browser traffic (<code>status 12</code>
              ). Making it work would mean impersonating the Roblox client, which this
              extension will not do. It would need a backend of our own to be done properly.
            </>
          )}
        </span>
      </div>
    </Section>
  );
}
