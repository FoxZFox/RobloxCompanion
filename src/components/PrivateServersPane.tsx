import { useEffect, useState } from 'react';
import { describeExpiry } from '../features/privateServers/privateServers';
import { sendQuery } from '../hooks/sendQuery';
import type { AppState, UiRequest } from '../models/messages';
import type { PrivateServer } from '../models/privateServer';
import { copyText } from '../utils/clipboard';
import { explain } from '../config/release';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * Private servers you own, and the ones you may enter here (phase 6).
 *
 * Two things it will not do, both for the same reason - a write to Roblox on the user's
 * behalf is not ours to make. It never creates a server, because that spends Robux (§8);
 * and it never mints a share link, because minting one means PATCHing the server, which
 * replaces the code and silently breaks whatever link the user already handed out. Where
 * Roblox has already made a link, Share link reads it; where it has not, it says so.
 */
export function PrivateServersPane({ state, busy, send }: Props): React.JSX.Element {
  const { privateServers: data } = state;
  const experience = state.experience;

  /*
   * Fetched when the tool is opened, not while building app state: this is a whole-account
   * call and has no business firing because somebody opened the popup.
   */
  useEffect(() => {
    if (data.fetchedAt === null) send({ type: 'privateServers/refresh' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount, on purpose
  }, []);

  const now = Date.now();

  return (
    <>
      <div className="rc-card" style={{ marginBottom: 10 }}>
        <div className="rc-card__label">This experience</div>

        {!experience?.placeId ? (
          <p className="rc-header__sub" style={{ marginTop: 0 }}>
            Open an experience to see whether it offers private servers.
          </p>
        ) : (
          <p className="rc-header__sub" style={{ marginTop: 0 }}>
            {data.enabledHere === null
              ? 'Roblox did not say whether this experience allows private servers.'
              : data.enabledHere
                ? 'This experience allows private servers.'
                : 'This experience does not allow private servers, so there is nothing to own here.'}
          </p>
        )}

        {/*
          Joinable servers come before owned ones because this is the list that can be
          acted on: it is what Roblox says this account may enter here, whether the server
          belongs to the user or to a friend who shared it.
        */}
        {data.joinableHere.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            {data.joinableHere.map((server) => (
              <div className="rc-row" key={server.vipServerId}>
                <div className="rc-row__top">
                  <strong>{server.name}</strong>
                  {server.playing !== null && server.maxPlayers !== null ? (
                    <span className="rc-row__count">
                      {server.playing}/{server.maxPlayers}
                    </span>
                  ) : null}
                </div>
                {server.ownerName ? (
                  <div className="rc-meta">
                    <span>owned by {server.ownerName}</span>
                  </div>
                ) : null}
                <div className="rc-btn-row">
                  <button
                    type="button"
                    className="rc-btn rc-btn--primary"
                    disabled={busy || !experience?.placeId}
                    onClick={() =>
                      send({
                        type: 'privateServers/join',
                        placeId: experience?.placeId ?? '',
                        vipServerId: server.vipServerId,
                      })
                    }
                  >
                    🔒 Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {data.here.length > 0 ? (
          data.here.map((server) => (
            <ServerRow key={server.privateServerId} server={server} now={now} busy={busy} send={send} />
          ))
        ) : (
          <div className="rc-empty">
            {data.fetchedAt === null
              ? 'Loading…'
              : data.enabledHere === false
                ? 'Not available here.'
                : 'You do not own a private server for this experience.'}
          </div>
        )}
      </div>

      {data.elsewhere.length > 0 ? (
        <div className="rc-card" style={{ marginBottom: 10 }}>
          <div className="rc-card__label">Your other private servers</div>
          {data.elsewhere.map((server) => (
            <ServerRow key={server.privateServerId} server={server} now={now} busy={busy} send={send} />
          ))}
        </div>
      ) : null}

      <div className="rc-card" style={{ marginBottom: 10 }}>
        {/*
          Stated rather than left as a puzzle. A private server tool with no join button
          looks broken unless the reason is on screen.
        */}
        {/*
          Two probes to get here. `vip-servers/{id}` answered `joinCode: null`, which
          would have left a write as the only route and no Join button at all; the
          per-place list turned out to carry the code, so joining costs nothing.
        */}
        <p className="rc-footnote" style={{ marginTop: 0 }}>
          {explain(
            'Nothing here creates or changes anything on Roblox, so links you have already shared keep working. Servers on other experiences have no Join button because Roblox only lets you in from the page you are on. Share link copies the link Roblox already made — if there is none, make one on its Roblox page.',
            'Join uses the access code Roblox already gives this account for servers you may enter here — no link is created or regenerated, so the invite links you have shared are untouched. Servers you own on other experiences are listed above without a Join button because Roblox only discloses codes for the place you are on. Share link reads the link Roblox has already made for a server you own; if there is none, make one on its Roblox page — generating one replaces the previous link, and that is not a thing to do on your behalf.',
          )}
        </p>
        <div className="rc-btn-row">
          <button
            type="button"
            className="rc-btn"
            disabled={busy || data.fetchedAt === null}
            onClick={() => send({ type: 'privateServers/refresh' })}
          >
            Refresh
          </button>
        </div>
      </div>
    </>
  );
}

function ServerRow({
  server,
  now,
  busy,
  send,
}: {
  server: PrivateServer;
  now: number;
  busy: boolean;
  send: (request: UiRequest) => void;
}): React.JSX.Element {
  const expiry = describeExpiry(server, now);
  /*
   * Local, and never lifted into AppState: the link admits anyone holding it, so it is
   * asked for one at a time and lives no longer than this row (see models/messages.ts).
   */
  const [outcome, setOutcome] = useState<string | null>(null);

  const askForLink = (): void => {
    setOutcome(null);
    void sendQuery({
      type: 'query/privateServerLink',
      privateServerId: server.privateServerId,
    }).then(async (result) => {
      if (!result.ok) {
        setOutcome(result.error.message);
        return;
      }
      if (!result.data.url) {
        setOutcome(result.data.reason);
        return;
      }
      // Straight to the clipboard and nowhere else - not into state, not onto the screen.
      const copied = await copyText(result.data.url);
      setOutcome(
        copied
          ? `Link copied. ${result.data.reason}`
          : 'Could not reach the clipboard. Open the server on Roblox and copy the link there.',
      );
    });
  };

  return (
    <div className="rc-row">
      <div className="rc-row__top">
        <strong>{server.name}</strong>
        {!server.active ? <span className="rc-chip rc-chip--unknown">inactive</span> : null}
      </div>
      <div className="rc-meta">
        <span>{server.universeName}</span>
        {expiry ? (
          <>
            <span className="rc-meta__sep">·</span>
            <span>{expiry}</span>
          </>
        ) : null}
        {server.willRenew ? (
          <>
            <span className="rc-meta__sep">·</span>
            <span>renews automatically</span>
          </>
        ) : null}
        {/*
          Shown only when Roblox gave a number. A price read per game would be wrong
          anyway: since April 2026 Premium members get these free on experiences that
          charge everyone else.
        */}
        {server.priceInRobux !== null ? (
          <>
            <span className="rc-meta__sep">·</span>
            <span>{server.priceInRobux} Robux to renew</span>
          </>
        ) : null}
      </div>
      <div className="rc-btn-row">
        <button
          type="button"
          className="rc-btn"
          disabled={busy}
          onClick={() => send({ type: 'tab/openGame', placeId: server.placeId })}
        >
          Open on Roblox
        </button>
        <button
          type="button"
          className="rc-btn"
          aria-label={`Copy the share link for ${server.name}`}
          title="Copies the link Roblox has already made for this server. It creates nothing and changes nothing."
          disabled={busy}
          onClick={askForLink}
        >
          🔗 Share link
        </button>
      </div>
      {/*
        Spoken as well as shown: the button's whole outcome is invisible - the text went
        to the clipboard - so nothing else would tell a screen reader user it worked.
      */}
      {outcome ? (
        <div className="rc-footnote" role="status">
          {outcome}
        </div>
      ) : null}
    </div>
  );
}
