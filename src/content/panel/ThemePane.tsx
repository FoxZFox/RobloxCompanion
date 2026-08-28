import { useEffect, useState } from 'react';
import { ThemePicker } from '../../components/ThemePicker';
import type { AppState, UiRequest } from '../../models/messages';
import { THEME_OFF } from '../../models/theme';
import { measureSurfaces, themeState, type SurfaceMatch, type ThemeState } from '../injectors/themeInjector';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * The panel's Themes tool, which can do one thing the options page cannot: look at the
 * page and say what actually happened.
 *
 * That is the whole reason this pane exists rather than only a settings section. A theme
 * touching roblox.com depends on their class names, and when one is renamed the result is
 * a page that is half painted with no explanation. Here it reads "Cards and sections: no
 * match on this page", which is a fact the user can act on - and report back with.
 */
export function ThemePane({ state, busy, send }: Props): React.JSX.Element {
  const theme = state.settings.theme;
  const enabled = state.settings.features.themes;
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<ThemeState>(() => themeState());
  const [surfaces, setSurfaces] = useState<SurfaceMatch[]>([]);

  useEffect(() => {
    /*
     * The injector repaints from a storage event, so it may not have run yet when this
     * effect fires off the same change arriving via the service worker. A short wait lets
     * the two settle rather than reporting the state before last.
     */
    const timer = setTimeout(() => {
      setStatus(themeState());
      setSurfaces(measureSurfaces());
    }, 200);
    return () => clearTimeout(timer);
  }, [theme.preset, theme.restyleRobloxPage, enabled, tick]);

  const matched = surfaces.filter((surface) => surface.matched > 0).length;

  return (
    <>
      <div className="rc-card" style={{ marginBottom: 10 }}>
        <div className="rc-card__label">Theme</div>
        <ThemePicker state={state} busy={busy} send={send} />
      </div>

      {theme.preset === THEME_OFF ? null : (
        <div className="rc-card" style={{ marginBottom: 10 }}>
          <div className="rc-card__label">What it did to this page</div>

          {status.status === 'blocked' ? (
            <div className="rc-banner">
              roblox.com&apos;s Content-Security-Policy refused the stylesheet, so the theme is
              not applied on this page. Nothing has been changed.
            </div>
          ) : null}

          {status.status === 'off' ? (
            <p className="rc-header__sub" style={{ marginTop: 0 }}>
              Nothing injected on this page yet. Reload roblox.com if you have just changed
              this.
            </p>
          ) : null}

          {status.status === 'applied' && status.conflict ? (
            <div className="rc-banner">
              <strong>{status.name}</strong> is a {status.conflict.palette} palette, but Roblox is
              set to {status.conflict.page}. Recolouring Roblox&apos;s own page is paused: their
              text is coloured for their {status.conflict.page} theme, so putting a{' '}
              {status.conflict.palette} background under it would leave parts of the page
              readable only by selecting them. Switch Roblox to {status.conflict.palette} mode, or
              pick a palette marked &ldquo;for {status.conflict.page}&rdquo; above. The panel and
              the rest of the extension are themed either way.
            </div>
          ) : null}

          {status.status === 'applied' ? (
            <p className="rc-header__sub" style={{ marginTop: 0 }}>
              <strong>{status.name}</strong> is applied to everything this extension draws.
              {status.restyleRobloxPage
                ? ` Roblox's own page: ${matched} of ${surfaces.length} parts matched here.`
                : status.conflict
                  ? ' Roblox’s own page is untouched while the two themes disagree.'
                  : ' Roblox’s own page is left alone, as configured.'}
            </p>
          ) : null}

          {status.status === 'applied' && status.restyleRobloxPage ? (
            <>
              <ul className="rc-surfaces">
                {surfaces.map((surface) => (
                  <li
                    key={surface.id}
                    className={`rc-surface${surface.matched === 0 ? ' rc-surface--none' : ''}`}
                  >
                    <span className="rc-surface__label">{surface.label}</span>
                    <span className="rc-surface__count">
                      {surface.matched === 0 ? 'no match here' : `${surface.matched} elements`}
                    </span>
                  </li>
                ))}
              </ul>

              {/*
                Counted on this page, not in general: a profile page has no game cards and
                a settings page has no header links, so "no match" is only evidence when
                the part being looked for is one this page ought to have.
              */}
              <p className="rc-footnote">
                Counted on the page you are on right now. A part that finds nothing here may
                simply not exist on this page — check on a game page before concluding that
                Roblox renamed something.
              </p>
            </>
          ) : null}

          <div className="rc-btn-row">
            <button type="button" className="rc-btn" onClick={() => setTick((n) => n + 1)}>
              Re-check
            </button>
          </div>
        </div>
      )}
    </>
  );
}
